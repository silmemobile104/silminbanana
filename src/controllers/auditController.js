const DailyAudit = require('../models/DailyAudit');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

const getBranchExpectedStock = async (req, res, next) => {
  try {
    const branchId = req.query.branchId || (req.user.branch ? req.user.branch._id : null);
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสสาขา' });
    }

    const stocks = await Stock.find({ branch: branchId }).populate('product');
    
    const items = stocks.map(st => {
      const activeImeis = st.imei_serials
        ? st.imei_serials.filter(i => i.status === 'in_stock').map(i => i.imei)
        : [];
      
      return {
        product: st.product._id,
        sku: st.sku,
        productName: st.product.name,
        expectedCount: st.quantity,
        expectedImeis: activeImeis
      };
    });

    res.json({
      success: true,
      branchId,
      items
    });
  } catch (err) {
    next(err);
  }
};

const submitBranchAudit = async (req, res, next) => {
  try {
    const { auditDate, branchId, scannedItems } = req.body;

    const targetBranchId = branchId || (req.user.branch ? req.user.branch._id : null);
    if (!auditDate || !targetBranchId || !scannedItems || !Array.isArray(scannedItems)) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุวันที่ สาขา และผลการนับสินค้าให้ครบถ้วน' });
    }

    const branch = await Branch.findById(targetBranchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขา' });
    }

    const stocks = await Stock.find({ branch: targetBranchId }).populate('product');
    const stockMap = new Map();
    stocks.forEach(st => {
      stockMap.set(st.sku, st);
    });

    let totalExpected = 0;
    let totalActual = 0;
    let totalVariance = 0;

    const auditedItems = [];
    const allSkus = new Set([...stockMap.keys(), ...scannedItems.map(si => si.sku)]);

    for (const sku of allSkus) {
      const stock = stockMap.get(sku);
      const scanned = scannedItems.find(si => si.sku === sku) || { actualCount: 0, scannedImeis: [] };

      const expectedCount = stock ? stock.quantity : 0;
      const actualCount = Number(scanned.actualCount) || (scanned.scannedImeis ? scanned.scannedImeis.length : 0);
      
      // AUTOMATED VARIANCE CALCULATION
      const variance = actualCount - expectedCount;

      const expectedImeis = stock && stock.imei_serials
        ? stock.imei_serials.filter(i => i.status === 'in_stock').map(i => i.imei)
        : [];
      
      const scannedImeis = scanned.scannedImeis || [];

      const missingImeis = expectedImeis.filter(i => !scannedImeis.includes(i));
      const unexpectedImeis = scannedImeis.filter(i => !expectedImeis.includes(i));

      totalExpected += expectedCount;
      totalActual += actualCount;
      totalVariance += Math.abs(variance);

      auditedItems.push({
        product: stock ? stock.product._id : null,
        sku,
        productName: stock ? stock.product.name : sku,
        expectedCount,
        actualCount,
        variance,
        expectedImeis,
        scannedImeis,
        missingImeis,
        unexpectedImeis
      });
    }

    let audit = await DailyAudit.findOne({ auditDate, branch: targetBranchId });

    if (audit) {
      audit.submittedBy = req.user._id;
      audit.status = 'Pending Verification';
      audit.items = auditedItems;
      audit.totalExpected = totalExpected;
      audit.totalActual = totalActual;
      audit.totalVariance = totalVariance;
      audit.auditLog.push({
        action: 'RESUBMIT_DAILY_CHECK',
        performedBy: req.user._id,
        timestamp: new Date(),
        notes: `ส่งรายงานนับสต็อกประจำวันซ้ำ ยอดต่างรวม ${totalVariance} ชิ้น`
      });
      await audit.save();
    } else {
      audit = await DailyAudit.create({
        auditDate,
        branch: targetBranchId,
        submittedBy: req.user._id,
        status: 'Pending Verification',
        items: auditedItems,
        totalExpected,
        totalActual,
        totalVariance,
        auditLog: [{
          action: 'SUBMIT_DAILY_CHECK',
          performedBy: req.user._id,
          timestamp: new Date(),
          notes: `ส่งรายงานนับสต็อกประจำวัน ยอดต่างรวม ${totalVariance} ชิ้น`
        }]
      });
    }

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'SUBMIT_DAILY_AUDIT',
      entity: 'DailyAudit',
      entityId: audit._id.toString(),
      details: { auditDate, branch: branch.name, totalVariance }
    });

    const populatedAudit = await DailyAudit.findById(audit._id).populate('branch submittedBy hqVerifiedBy');

    res.status(200).json({
      success: true,
      message: 'ส่งรายงานนับสต็อกประจำวันเรียบร้อยแล้ว สถานะ: รอการตรวจสอบจากส่วนกลาง',
      audit: populatedAudit
    });
  } catch (err) {
    next(err);
  }
};

const getHqDashboard = async (req, res, next) => {
  try {
    const auditDate = req.query.date || new Date().toISOString().split('T')[0];

    const branches = await Branch.find({ isActive: true }).sort({ code: 1 });
    const audits = await DailyAudit.find({ auditDate })
      .populate('branch submittedBy hqVerifiedBy items.product');

    const auditMap = new Map();
    audits.forEach(a => {
      if (a.branch) {
        auditMap.set(a.branch._id.toString(), a);
      }
    });

    const branchSummaries = branches.map(branch => {
      const audit = auditMap.get(branch._id.toString());
      
      let status = 'ยังไม่ได้ส่งรายงาน';
      let totalExpected = 0;
      let totalActual = 0;
      let totalVariance = 0;
      let colorCode = 'gray';
      let hasVariance = false;

      if (audit) {
        const rawStatus = audit.status;
        totalExpected = audit.totalExpected;
        totalActual = audit.totalActual;
        totalVariance = audit.totalVariance;
        hasVariance = totalVariance !== 0;

        if (rawStatus === 'Verified') {
          status = 'ตรวจสอบแล้ว';
          colorCode = hasVariance ? 'yellow' : 'green';
        } else if (rawStatus === 'Rejected') {
          status = 'ข้อมูลไม่ตรง/ปฏิเสธ';
          colorCode = 'red';
        } else {
          status = 'รอการตรวจสอบ';
          colorCode = hasVariance ? 'red' : 'green';
        }
      }

      return {
        branch: {
          id: branch._id,
          code: branch.code,
          name: branch.name,
          phone: branch.phone
        },
        auditDate,
        auditId: audit ? audit._id : null,
        status,
        rawStatus: audit ? audit.status : 'Not Submitted',
        colorCode,
        hasVariance,
        totalExpected,
        totalActual,
        totalVariance,
        submittedBy: audit && audit.submittedBy ? audit.submittedBy.username : null,
        submittedAt: audit ? audit.updatedAt : null,
        hqComments: audit ? audit.hqComments : '',
        hqVerifiedBy: audit && audit.hqVerifiedBy ? audit.hqVerifiedBy.username : null,
        items: audit ? audit.items : []
      };
    });

    res.json({
      success: true,
      auditDate,
      summary: {
        totalBranches: branches.length,
        submittedCount: audits.length,
        pendingCount: audits.filter(a => a.status === 'Pending Verification').length,
        verifiedCount: audits.filter(a => a.status === 'Verified').length,
        rejectedCount: audits.filter(a => a.status === 'Rejected').length,
        branches: branchSummaries
      }
    });
  } catch (err) {
    next(err);
  }
};

const verifyOrRejectAudit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;

    if (!['Verify', 'Reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'คำสั่งต้องเป็น "Verify" หรือ "Reject"' });
    }

    const audit = await DailyAudit.findById(id).populate('branch');
    if (!audit) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายงานการนับสต็อก' });
    }

    const newStatus = action === 'Verify' ? 'Verified' : 'Rejected';

    audit.status = newStatus;
    audit.hqVerifiedBy = req.user._id;
    audit.hqVerifiedAt = new Date();
    audit.hqComments = comments || '';
    audit.auditLog.push({
      action: `HQ_${action.toUpperCase()}`,
      performedBy: req.user._id,
      timestamp: new Date(),
      notes: comments || `HQ ${action}ed audit`
    });

    await audit.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: `HQ_AUDIT_${action.toUpperCase()}`,
      entity: 'DailyAudit',
      entityId: audit._id.toString(),
      details: { branch: audit.branch.name, auditDate: audit.auditDate, status: newStatus, comments }
    });

    const updatedAudit = await DailyAudit.findById(audit._id).populate('branch submittedBy hqVerifiedBy');

    res.json({
      success: true,
      message: `อัปเดตสถานะการตรวจสอบเรียบร้อยแล้ว (${action === 'Verify' ? 'อนุมัติ/ตรวจสอบแล้ว' : 'ปฏิเสธ/ข้อมูลไม่ตรง'})`,
      audit: updatedAudit
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBranchExpectedStock,
  submitBranchAudit,
  getHqDashboard,
  verifyOrRejectAudit
};

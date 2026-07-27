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

    const todayStr = new Date().toISOString().split('T')[0];
    const existingAudit = await DailyAudit.findOne({ auditDate: todayStr, branch: branchId });

    // Collect all scanned IMEIs and uploaded photo URLs from existing daily audit for today
    const scannedImeiSet = new Set();
    const imeiImageMap = new Map();

    if (existingAudit && existingAudit.items) {
      existingAudit.items.forEach(item => {
        (item.scannedImeis || []).forEach(im => scannedImeiSet.add(im));
        (item.imeiImages || []).forEach(img => {
          const fid = img.fileId || img.driveFileId || (img.url ? (img.url.match(/\/d\/([a-zA-Z0-9_-]+)/) || img.url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1] : null);
          const imgUrl = fid ? `/api/audit/drive-image/${fid}` : (img.url || img.imageUrl || img.driveWebViewLink);
          if (img.imei && imgUrl) {
            imeiImageMap.set(img.imei, imgUrl);
          }
        });
      });
    }

    // Fetch all active stock items (1 per device IMEI)
    const stocks = await Stock.find({ branch: branchId, status: 'in_stock' }).populate('product').sort({ createdAt: -1 });

    const items = stocks.map(st => {
      const pName = st.product ? st.product.name : (st.productName || 'สินค้าไม่ระบุชื่อ');
      const imei = st.imei || '';
      const isScanned = imei ? scannedImeiSet.has(imei) : false;
      const photoUrl = imei ? imeiImageMap.get(imei) || null : null;

      return {
        stockId: st._id,
        product: st.product ? st.product._id : null,
        productName: pName,
        imei: imei || 'ไม่มี IMEI',
        expectedCount: 1,
        expectedImeis: imei ? [imei] : [],
        scannedImeis: isScanned ? [imei] : [],
        isScanned,
        photoUrl,
        imeiImages: photoUrl ? [{ imei, imageUrl: photoUrl }] : []
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

    const stocks = await Stock.find({ branch: targetBranchId, status: 'in_stock' }).populate('product');
    const productMap = new Map();

    stocks.forEach(st => {
      if (!st.product) return;
      const pIdStr = st.product._id.toString();
      if (!productMap.has(pIdStr)) {
        productMap.set(pIdStr, {
          product: st.product._id,
          productName: st.product.name || st.productName,
          imeis: []
        });
      }
      if (st.imei) productMap.get(pIdStr).imeis.push(st.imei);
    });

    let totalExpected = 0;
    let totalActual = 0;
    let totalVariance = 0;

    const auditedItems = [];
    const processedProductIds = new Set();

    // Process scanned items
    for (const scanned of scannedItems) {
      const pIdStr = scanned.product ? scanned.product.toString() : null;
      const stockGrp = pIdStr ? productMap.get(pIdStr) : null;
      if (pIdStr) processedProductIds.add(pIdStr);

      const expectedImeis = stockGrp ? stockGrp.imeis : (scanned.expectedImeis || []);
      const expectedCount = expectedImeis.length;
      const scannedImeis = scanned.scannedImeis || [];
      const actualCount = scannedImeis.length;
      const variance = actualCount - expectedCount;

      const missingImeis = expectedImeis.filter(i => !scannedImeis.includes(i));
      const unexpectedImeis = scannedImeis.filter(i => !expectedImeis.includes(i));

      totalExpected += expectedCount;
      totalActual += actualCount;
      totalVariance += Math.abs(variance);

      auditedItems.push({
        product: scanned.product || (stockGrp ? stockGrp.product : null),
        productName: scanned.productName || (stockGrp ? stockGrp.productName : 'สินค้าไม่ระบุชื่อ'),
        expectedCount,
        actualCount,
        variance,
        expectedImeis,
        scannedImeis,
        missingImeis,
        unexpectedImeis,
        imeiImages: scanned.imeiImages || []
      });
    }

    // Process any products in stock that were not in scannedItems
    for (const [pIdStr, stockGrp] of productMap.entries()) {
      if (!processedProductIds.has(pIdStr)) {
        const expectedImeis = stockGrp.imeis;
        const expectedCount = expectedImeis.length;
        const actualCount = 0;
        const variance = -expectedCount;

        totalExpected += expectedCount;
        totalActual += 0;
        totalVariance += Math.abs(variance);

        auditedItems.push({
          product: stockGrp.product,
          productName: stockGrp.productName,
          expectedCount,
          actualCount,
          variance,
          expectedImeis,
          scannedImeis: [],
          missingImeis: expectedImeis,
          unexpectedImeis: [],
          imeiImages: []
        });
      }
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

    // Fetch real-time expected stocks from Stock collection for fallback calculations
    const allStocks = await Stock.find({ status: 'in_stock' }).populate('product');
    const branchStocksMap = new Map();
    allStocks.forEach(st => {
      if (st.branch && st.product) {
        const bId = st.branch.toString();
        if (!branchStocksMap.has(bId)) {
          branchStocksMap.set(bId, []);
        }
        branchStocksMap.get(bId).push(st.imei);
      }
    });

    const branchSummaries = branches.map(branch => {
      const bIdStr = branch._id.toString();
      const audit = auditMap.get(bIdStr);
      
      let status = 'ยังไม่ได้ส่งรายงาน';
      let totalExpected = 0;
      let totalActual = 0;
      let totalVariance = 0;
      let colorCode = 'yellow';
      let hasVariance = false;
      let items = [];

      if (audit) {
        const rawStatus = audit.status;
        totalExpected = audit.totalExpected;
        totalActual = audit.totalActual;
        totalVariance = audit.totalVariance;
        hasVariance = totalVariance !== 0;
        items = audit.items || [];

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
      } else {
        const fallbackImeis = branchStocksMap.get(bIdStr) || [];
        totalExpected = fallbackImeis.length;
        totalActual = 0;
        totalVariance = totalExpected;
        hasVariance = totalExpected > 0;
        status = 'ยังไม่ได้ส่งรายงาน';
        colorCode = 'yellow';
        items = [];
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
        submittedBy: audit && audit.submittedBy ? (audit.submittedBy.fullName || audit.submittedBy.username) : null,
        submittedAt: audit ? audit.updatedAt : null,
        hqComments: audit ? audit.hqComments : '',
        hqVerifiedBy: audit && audit.hqVerifiedBy ? (audit.hqVerifiedBy.fullName || audit.hqVerifiedBy.username) : null,
        items
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

const uploadImeiImage = async (req, res, next) => {
  try {
    const { imei, auditDate } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพเพื่ออัปโหลด' });
    }

    if (!imei) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI' });
    }

    const { uploadImeiImageToDrive } = require('../config/googleDrive');

    const driveResult = await uploadImeiImageToDrive({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      imei: imei.trim(),
      dateStr: auditDate || new Date().toISOString().split('T')[0]
    });

    res.json({
      success: true,
      message: `อัปโหลดรูปถ่ายสำหรับ IMEI ${imei} ขึ้น Google Drive สำเร็จ`,
      fileId: driveResult.fileId,
      url: driveResult.url || driveResult.webViewLink,
      webViewLink: driveResult.webViewLink,
      webContentLink: driveResult.webContentLink,
      fileName: driveResult.fileName
    });
  } catch (err) {
    next(err);
  }
};

const driveImageCache = new Map();

const proxyDriveImage = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).send('Missing fileId');
    }

    if (driveImageCache.has(fileId)) {
      const cached = driveImageCache.get(fileId);
      res.setHeader('Content-Type', cached.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(cached.buffer);
    }

    const { getAccessToken } = require('../config/googleDrive');
    const accessToken = await getAccessToken();

    const https = require('https');
    const googleReq = https.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, (googleRes) => {
      if (googleRes.statusCode >= 200 && googleRes.statusCode < 300) {
        const contentType = googleRes.headers['content-type'] || 'image/jpeg';
        const chunks = [];

        googleRes.on('data', (chunk) => chunks.push(chunk));
        googleRes.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length > 0) {
            driveImageCache.set(fileId, { contentType, buffer });
          }
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
          res.send(buffer);
        });
      } else if (googleRes.statusCode === 429) {
        res.redirect(`https://drive.google.com/file/d/${fileId}/view`);
      } else {
        res.redirect(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
      }
    });

    googleReq.on('error', () => {
      res.redirect(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
    });

    googleReq.end();
  } catch (err) {
    res.redirect(`https://drive.google.com/thumbnail?id=${req.params.fileId}&sz=w1000`);
  }
};

const saveImeiDecision = async (req, res, next) => {
  try {
    const { auditDate, branchId, imei, decision } = req.body;
    if (!auditDate || !branchId || !imei || !decision) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ วันที่, สาขา, IMEI และผลการลงความเห็น' });
    }

    let audit = await DailyAudit.findOne({ auditDate, branch: branchId });
    if (!audit) {
      audit = new DailyAudit({
        auditDate,
        branch: branchId,
        submittedBy: req.user._id,
        items: [],
        totalExpected: 0,
        totalActual: 0,
        totalVariance: 0
      });
    }

    let foundItem = false;
    for (const item of audit.items) {
      const hasImei = (item.scannedImeis && item.scannedImeis.includes(imei)) ||
        (item.expectedImeis && item.expectedImeis.includes(imei));
      if (hasImei) {
        foundItem = true;
        item.imeiDecisions = item.imeiDecisions || [];
        const existingIdx = item.imeiDecisions.findIndex(d => d.imei === imei);
        if (existingIdx >= 0) {
          item.imeiDecisions[existingIdx].decision = decision;
          item.imeiDecisions[existingIdx].updatedAt = new Date();
        } else {
          item.imeiDecisions.push({ imei, decision, updatedAt: new Date() });
        }

        if (decision === 'resubmit') {
          if (item.scannedImeis && item.scannedImeis.includes(imei)) {
            item.scannedImeis = item.scannedImeis.filter(im => im !== imei);
          }
          if (item.imeiImages && item.imeiImages.length > 0) {
            item.imeiImages = item.imeiImages.filter(img => img.imei !== imei);
          }
          item.actualCount = item.scannedImeis ? item.scannedImeis.length : 0;
          item.variance = item.actualCount - item.expectedCount;
        }

        break;
      }
    }

    if (!foundItem) {
      audit.items.push({
        product: req.user._id,
        productName: `IMEI: ${imei}`,
        expectedCount: 1,
        actualCount: decision === 'resubmit' ? 0 : 1,
        variance: decision === 'resubmit' ? -1 : 0,
        scannedImeis: decision === 'resubmit' ? [] : [imei],
        imeiDecisions: [{ imei, decision, updatedAt: new Date() }]
      });
    }

    // Recalculate audit totals
    let totalExp = 0;
    let totalAct = 0;
    let totalVar = 0;
    audit.items.forEach(it => {
      totalExp += it.expectedCount || 0;
      totalAct += it.actualCount || 0;
      totalVar += Math.abs(it.variance || 0);
    });

    audit.totalExpected = totalExp;
    audit.totalActual = totalAct;
    audit.totalVariance = totalVar;

    await audit.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'AUDIT_ITEM_DECISION',
      entity: 'DailyAudit',
      entityId: audit._id.toString(),
      details: { auditDate, imei, decision }
    });

    res.status(200).json({
      success: true,
      message: `บันทึกผลการลงความเห็น IMEI ${imei}: ${decision} ลงฐานข้อมูลสำเร็จ`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBranchExpectedStock,
  submitBranchAudit,
  getHqDashboard,
  verifyOrRejectAudit,
  uploadImeiImage,
  proxyDriveImage,
  saveImeiDecision
};

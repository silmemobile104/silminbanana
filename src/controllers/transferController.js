const StockTransfer = require('../models/StockTransfer');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');

const createTransfer = async (req, res, next) => {
  try {
    const { fromBranchId, toBranchId, items, remarks } = req.body;

    if (!fromBranchId || !toBranchId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุสาขาต้นทาง สาขาปลายทาง และรายการสินค้าให้ครบถ้วน' });
    }

    if (fromBranchId === toBranchId) {
      return res.status(400).json({ success: false, message: 'สาขาต้นทางและสาขาปลายทางต้องเป็นคนละสาขากัน' });
    }

    const [fromBranch, toBranch] = await Promise.all([
      Branch.findById(fromBranchId),
      Branch.findById(toBranchId)
    ]);

    if (!fromBranch || !toBranch) {
      return res.status(404).json({ success: false, message: 'ข้อมูลสาขาต้นทางหรือปลายทางไม่ถูกต้อง' });
    }

    // Validate available stock in fromBranch
    const preparedItems = [];
    for (const item of items) {
      const imeiList = item.imei_serials || (item.imei ? [item.imei] : []);
      if (imeiList.length === 0) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI ที่ต้องการโอนย้าย' });
      }

      for (const targetImei of imeiList) {
        const stock = await Stock.findOne({ branch: fromBranchId, imei: targetImei, status: 'in_stock' }).populate('product');
        if (!stock) {
          return res.status(400).json({ 
            success: false, 
            message: `ไม่พบสินค้า IMEI "${targetImei}" ที่ ${fromBranch.name} หรือไม่ได้อยู่ในสถานะพร้อมโอน` 
          });
        }

        // Lock stock item immediately by setting status to 'in_transit'
        stock.status = 'in_transit';
        await stock.save();

        preparedItems.push({
          product: stock.product ? stock.product._id : null,
          productName: stock.productName || (stock.product ? stock.product.name : 'สินค้าไม่ระบุชื่อ'),
          quantity: 1,
          imei_serials: [targetImei]
        });
      }
    }

    const transferCount = await StockTransfer.countDocuments();
    const transferNumber = `TRF-${new Date().getFullYear()}-${String(transferCount + 1).padStart(5, '0')}`;

    const transfer = await StockTransfer.create({
      transferNumber,
      fromBranch: fromBranch._id,
      toBranch: toBranch._id,
      items: preparedItems,
      requestedBy: req.user._id,
      remarks: remarks || '',
      status: 'in_transit'
    });

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_TRANSFER',
      entity: 'StockTransfer',
      entityId: transfer._id.toString(),
      details: { transferNumber, from: fromBranch.name, to: toBranch.name }
    });

    const populatedTransfer = await StockTransfer.findById(transfer._id).populate('fromBranch toBranch requestedBy');

    res.status(201).json({
      success: true,
      message: 'สร้างเอกสารโอนย้ายสินค้าระหว่างสาขาเรียบร้อยแล้ว',
      transfer: populatedTransfer
    });
  } catch (err) {
    next(err);
  }
};

const getTransfers = async (req, res, next) => {
  try {
    const { branchId, status } = req.query;
    const filter = {};

    if (branchId) {
      filter.$or = [{ fromBranch: branchId }, { toBranch: branchId }];
    }
    if (status) filter.status = status;

    const transfers = await StockTransfer.find(filter)
      .populate('fromBranch toBranch requestedBy approvedBy items.product')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transfers
    });
  } catch (err) {
    next(err);
  }
};

const updateTransferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['approved', 'in_transit', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะเอกสารไม่ถูกต้อง' });
    }

    const transfer = await StockTransfer.findById(id).populate('fromBranch toBranch');
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการโอนย้ายสินค้า' });
    }

    if (transfer.status === 'completed' || transfer.status === 'rejected') {
      return res.status(400).json({ success: false, message: `รายการนี้อยู่ในสถานะ ${transfer.status} แล้ว ไม่สามารถเปลี่ยนแปลงได้` });
    }

    // Process completion -> migrate stock documents directly by IMEI from fromBranch to toBranch
    if (status === 'completed') {
      for (const item of transfer.items) {
        const targetImeis = item.imei_serials || [];
        for (const im of targetImeis) {
          await Stock.updateOne(
            { imei: im },
            { $set: { branch: transfer.toBranch._id, status: 'in_stock', import_date: new Date() } }
          );
        }
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      // Restore stock back to source branch as active in_stock
      for (const item of transfer.items) {
        const targetImeis = item.imei_serials || [];
        for (const im of targetImeis) {
          await Stock.updateOne(
            { imei: im },
            { $set: { branch: transfer.fromBranch._id, status: 'in_stock' } }
          );
        }
      }
    }

    transfer.status = status;
    transfer.approvedBy = req.user._id;
    if (remarks) transfer.remarks = remarks;
    await transfer.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: `TRANSFER_STATUS_${status.toUpperCase()}`,
      entity: 'StockTransfer',
      entityId: transfer._id.toString(),
      details: { transferNumber: transfer.transferNumber, newStatus: status }
    });

    const updatedTransfer = await StockTransfer.findById(transfer._id).populate('fromBranch toBranch requestedBy approvedBy');

    res.json({
      success: true,
      message: `อัปเดตสถานะเอกสารโอนย้ายสำเร็จเป็น ${status}`,
      transfer: updatedTransfer
    });
  } catch (err) {
    next(err);
  }
};

const getTransferDocument = async (req, res, next) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id)
      .populate('fromBranch toBranch requestedBy approvedBy items.product');

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'ไม่พบเอกสารใบโอนย้ายสินค้า' });
    }

    res.json({
      success: true,
      document: {
        documentTitle: 'ใบโอนย้ายสินค้าระหว่างสาขา',
        transferNumber: transfer.transferNumber,
        date: transfer.createdAt,
        status: transfer.status,
        fromBranch: transfer.fromBranch,
        toBranch: transfer.toBranch,
        requestedBy: transfer.requestedBy ? (transfer.requestedBy.fullName || transfer.requestedBy.username) : 'ไม่ระบุ',
        approvedBy: transfer.approvedBy ? (transfer.approvedBy.fullName || transfer.approvedBy.username) : 'ไม่ระบุ',
        items: transfer.items,
        remarks: transfer.remarks
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  updateTransferStatus,
  getTransferDocument
};

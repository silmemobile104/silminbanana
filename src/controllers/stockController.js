const Stock = require('../models/Stock');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

// Goods Receipt - Add stock to a specific branch
const receiveStock = async (req, res, next) => {
  try {
    const { branchId, productId, quantity, imeiSerials } = req.body;

    if (!branchId || !productId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุสาขา สินค้า และจำนวนสินค้าให้ถูกต้อง' });
    }

    const [branch, product] = await Promise.all([
      Branch.findById(branchId),
      Product.findById(productId)
    ]);

    if (!branch || !branch.isActive) {
      return res.status(404).json({ success: false, message: 'สาขาที่เลือกไม่ถูกต้อง หรือถูกปิดใช้งาน' });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสินค้าที่ระบุ' });
    }

    let newImeis = [];
    if (Array.isArray(imeiSerials) && imeiSerials.length > 0) {
      const cleanSerials = imeiSerials.map(s => String(s).trim()).filter(s => s.length > 0);
      
      const uniqueInputSerials = new Set(cleanSerials);
      if (uniqueInputSerials.size !== cleanSerials.length) {
        return res.status(400).json({ success: false, message: 'พบหมายเลขซีเรียล/IMEI ซ้ำซ้อนในรายการที่กรอกเข้ามา' });
      }

      const existingStockWithSerials = await Stock.find({ 'imei_serials.imei': { $in: cleanSerials } });
      let duplicateIMEIs = [];
      existingStockWithSerials.forEach(st => {
        st.imei_serials.forEach(item => {
          if (cleanSerials.includes(item.imei) && item.status === 'in_stock') {
            duplicateIMEIs.push(item.imei);
          }
        });
      });

      if (duplicateIMEIs.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `พบหมายเลขซีเรียล/IMEI มีอยู่ในระบบแล้ว: ${duplicateIMEIs.join(', ')}` 
        });
      }

      newImeis = cleanSerials.map(s => ({
        imei: s,
        status: 'in_stock',
        received_date: new Date()
      }));
    }

    let stock = await Stock.findOne({ branch: branch._id, sku: product.sku });
    const importTimestamp = new Date(); // Automated Import Date

    if (stock) {
      stock.quantity += Number(quantity);
      if (newImeis.length > 0) {
        stock.imei_serials.push(...newImeis);
      }
      stock.import_date = importTimestamp;
      await stock.save();
    } else {
      stock = await Stock.create({
        branch: branch._id,
        product: product._id,
        sku: product.sku,
        quantity: Number(quantity),
        imei_serials: newImeis,
        import_date: importTimestamp
      });
    }

    if (newImeis.length > 0) {
      const addedImeis = newImeis.map(i => i.imei);
      await Product.findByIdAndUpdate(product._id, {
        $addToSet: { imei_serial: { $each: addedImeis } }
      });
    }

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'GOODS_RECEIPT',
      entity: 'Stock',
      entityId: stock._id.toString(),
      details: {
        branch: branch.name,
        sku: product.sku,
        quantityAdded: quantity,
        import_date: importTimestamp
      }
    });

    const populatedStock = await Stock.findById(stock._id).populate('branch product');

    res.status(200).json({
      success: true,
      message: `บันทึกการรับสินค้าเข้าสต็อกสำเร็จ จำนวน ${quantity} ชิ้น เข้าสู่ ${branch.name}`,
      stock: populatedStock
    });
  } catch (err) {
    next(err);
  }
};

// Fetch current user's branch stock ONLY (strictly isolated per branch for branch staff)
const getMyBranchStock = async (req, res, next) => {
  try {
    let targetBranchId = req.query.branchId;

    // For branch staff, enforce viewing ONLY their assigned branch
    if (req.user.role === 'branch_staff' || !targetBranchId) {
      if (req.user.branch) {
        targetBranchId = req.user.branch._id || req.user.branch;
      }
    }

    if (!targetBranchId) {
      // Fallback for admin or unassigned staff to first branch
      const firstBranch = await Branch.findOne({ isActive: true });
      targetBranchId = firstBranch ? firstBranch._id : null;
    }

    if (!targetBranchId) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลสาขาที่สังกัด' });
    }

    const branch = await Branch.findById(targetBranchId);
    const stockList = await Stock.find({ branch: targetBranchId }).populate('product branch');

    res.json({
      success: true,
      branch,
      count: stockList.length,
      stock: stockList
    });
  } catch (err) {
    next(err);
  }
};

const getBranchStock = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const stockList = await Stock.find({ branch: branchId }).populate('product branch');

    res.json({
      success: true,
      count: stockList.length,
      stock: stockList
    });
  } catch (err) {
    next(err);
  }
};

const getAllBranchStock = async (req, res, next) => {
  try {
    const stockList = await Stock.find().populate('branch product').sort({ 'branch': 1, 'sku': 1 });

    res.json({
      success: true,
      count: stockList.length,
      stock: stockList
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  receiveStock,
  getMyBranchStock,
  getBranchStock,
  getAllBranchStock
};

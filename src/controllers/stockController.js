const Stock = require('../models/Stock');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const GoodsReceipt = require('../models/GoodsReceipt');
const AuditLog = require('../models/AuditLog');

// Helper to generate Full Product Name
function generateAutoName(brand = '', model = '', capacity = '', color = '') {
  const parts = [brand, model, capacity, color].map(p => (p || '').trim()).filter(p => p.length > 0);
  return parts.join(' ');
}

// Goods Receipt - Direct Product Info Entry by Branch Staff (Creates GoodsReceipt using IMEI as SKU for each unit)
const receiveStock = async (req, res, next) => {
  try {
    const { branchId, brand, model, capacity, color, category, quantity, imeiSerials } = req.body;

    let targetBranchId = branchId;
    if (req.user && req.user.branch) {
      targetBranchId = req.user.branch._id || req.user.branch;
    }

    if (!targetBranchId || !brand || !model || !category || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ สาขา, ยี่ห้อ, ชื่อรุ่น, หมวดหมู่ และจำนวนสินค้าให้ถูกต้อง' });
    }

    const branch = await Branch.findById(targetBranchId);
    if (!branch || !branch.isActive) {
      return res.status(404).json({ success: false, message: 'สาขาที่เลือกไม่ถูกต้อง หรือถูกปิดใช้งาน' });
    }

    let cleanSerials = [];
    if (Array.isArray(imeiSerials)) {
      cleanSerials = imeiSerials.map(s => String(s).trim()).filter(s => s.length > 0);
    }

    if (cleanSerials.length !== Number(quantity)) {
      return res.status(400).json({ 
        success: false, 
        message: `จำนวนสินค้าที่รับเข้า (${quantity} ชิ้น) ต้องระบุหมายเลข IMEI/ซีเรียลให้ครบทุกเครื่อง (${cleanSerials.length}/${quantity} เครื่อง)` 
      });
    }

    const uniqueInputSerials = new Set(cleanSerials);
    if (uniqueInputSerials.size !== cleanSerials.length) {
      return res.status(400).json({ success: false, message: 'พบหมายเลขซีเรียล/IMEI ซ้ำซ้อนในรายการที่กรอกเข้ามา' });
    }

    // Check existing stock IMEIs or SKUs
    const existingStockWithSerials = await Stock.find({ 
      $or: [
        { 'imei_serials.imei': { $in: cleanSerials } },
        { 'sku': { $in: cleanSerials } }
      ]
    });
    
    let duplicateIMEIs = [];
    existingStockWithSerials.forEach(st => {
      if (cleanSerials.includes(st.sku)) {
        duplicateIMEIs.push(st.sku);
      }
      st.imei_serials.forEach(item => {
        if (cleanSerials.includes(item.imei) && item.status === 'in_stock') {
          duplicateIMEIs.push(item.imei);
        }
      });
    });

    if (duplicateIMEIs.length > 0) {
      const uniqueDupes = [...new Set(duplicateIMEIs)];
      return res.status(400).json({ 
        success: false, 
        message: `พบหมายเลขซีเรียล/IMEI (SKU) มีอยู่ในระบบคลังสินค้าแล้ว: ${uniqueDupes.join(', ')}` 
      });
    }

    const generatedName = generateAutoName(brand, model, capacity, color);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);

    const createdReceipts = [];

    // Create an individual SKU entry per IMEI according to user requirements
    for (let i = 0; i < cleanSerials.length; i++) {
      const currentImei = cleanSerials[i];
      const receiptNumber = `GR-${branch.code || 'HQ'}-${todayStr}-${randomNum}-${i + 1}`;

      const receipt = await GoodsReceipt.create({
        receiptNumber,
        branch: branch._id,
        receivedBy: req.user._id,
        productInfo: {
          sku: currentImei, // Use IMEI as SKU
          name: generatedName,
          brand: brand.trim(),
          model: model.trim(),
          capacity: capacity ? capacity.trim() : '',
          color: color ? color.trim() : '',
          category: category.trim()
        },
        quantity: 1,
        imeiSerials: [currentImei],
        status: 'pending_pricing'
      });

      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'SUBMIT_GOODS_RECEIPT',
        entity: 'GoodsReceipt',
        entityId: receipt._id.toString(),
        details: { receiptNumber: receipt.receiptNumber, branch: branch.name, sku: currentImei, imei: currentImei }
      });

      createdReceipts.push(receipt);
    }

    res.status(201).json({
      success: true,
      message: `บันทึกรับสินค้าเข้าสต็อกสำเร็จ ${createdReceipts.length} รายการ (สร้าง SKU อัตโนมัติจากเลข IMEI เรียบร้อยแล้ว รอฝ่ายจัดซื้อ/สต็อกตั้งราคา)`,
      count: createdReceipts.length
    });
  } catch (err) {
    next(err);
  }
};

// Fetch Goods Receipts List (for verification & pricing)
const getGoodsReceipts = async (req, res, next) => {
  try {
    const { status, branchId } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (['branch_staff', 'technical_staff'].includes(req.user.role)) {
      if (req.user.branch) {
        query.branch = req.user.branch;
      }
    } else if (branchId) {
      query.branch = branchId;
    }

    const receipts = await GoodsReceipt.find(query)
      .populate('branch', 'name code phone')
      .populate('receivedBy', 'fullName username')
      .populate('confirmedBy', 'fullName username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: receipts.length,
      receipts
    });
  } catch (err) {
    next(err);
  }
};

// Confirm Goods Receipt & Assign Purchase/Selling Prices (Single Item)
const confirmGoodsReceipt = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const { purchase_price, selling_price, remarks } = req.body;

    if (purchase_price === undefined || selling_price === undefined || Number(purchase_price) < 0 || Number(selling_price) < 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุราคาทุนและราคาขายให้ถูกต้อง' });
    }

    const receipt = await GoodsReceipt.findById(receiptId).populate('branch');
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการรับสินค้าที่ต้องการยืนยัน' });
    }

    if (receipt.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'รายการรับสินค้านี้ได้รับการยืนยันเข้าสต็อกไปแล้ว' });
    }

    const { sku, name, brand, model, capacity, color, category } = receipt.productInfo;
    const pPrice = Number(purchase_price);
    const sPrice = Number(selling_price);

    // 1. Create or Update Product Master using IMEI as SKU
    let product = await Product.findOne({ sku });
    let finalVariation = `${capacity} ${color}`.trim() || 'มาตรฐาน';

    if (product) {
      product.name = name;
      product.brand = brand;
      product.model = model;
      product.capacity = capacity;
      product.color = color;
      product.category = category;
      product.purchase_price = pPrice;
      product.selling_price = sPrice;
      await product.save();
    } else {
      product = await Product.create({
        sku, // IMEI as SKU
        name,
        brand,
        model,
        capacity,
        color,
        variation: finalVariation,
        category,
        purchase_price: pPrice,
        selling_price: sPrice,
        images: [],
        hasImei: true
      });
    }

    // 2. Add Stock to the target Branch
    const newImeis = (receipt.imeiSerials || []).map(s => ({
      imei: s,
      status: 'in_stock',
      received_date: new Date()
    }));

    let stock = await Stock.findOne({ branch: receipt.branch._id, sku });
    const importTimestamp = new Date();

    if (stock) {
      stock.quantity += Number(receipt.quantity);
      if (newImeis.length > 0) {
        stock.imei_serials.push(...newImeis);
      }
      stock.import_date = importTimestamp;
      await stock.save();
    } else {
      stock = await Stock.create({
        branch: receipt.branch._id,
        product: product._id,
        sku,
        quantity: Number(receipt.quantity),
        imei_serials: newImeis,
        import_date: importTimestamp
      });
    }

    // 3. Update GoodsReceipt Status
    receipt.status = 'confirmed';
    receipt.purchase_price = pPrice;
    receipt.selling_price = sPrice;
    receipt.confirmedBy = req.user._id;
    receipt.confirmedAt = new Date();
    if (remarks) receipt.remarks = remarks.trim();
    await receipt.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CONFIRM_GOODS_RECEIPT',
      entity: 'GoodsReceipt',
      entityId: receipt._id.toString(),
      details: { receiptNumber: receipt.receiptNumber, sku, quantity: receipt.quantity, purchase_price: pPrice, selling_price: sPrice }
    });

    res.json({
      success: true,
      message: `ยืนยันรายการรับสินค้า SKU: ${sku} สำเร็จ สินค้าพร้อมขายหน้าร้านแล้ว`,
      receipt
    });
  } catch (err) {
    next(err);
  }
};

// Confirm Goods Receipts in Batch (Confirm multiple items with same prices)
const confirmBatchGoodsReceipts = async (req, res, next) => {
  try {
    const { receiptIds, purchase_price, selling_price, remarks } = req.body;

    if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรายการรับสินค้าที่ต้องการยืนยัน' });
    }

    if (purchase_price === undefined || selling_price === undefined || Number(purchase_price) < 0 || Number(selling_price) < 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุราคาทุนและราคาขายให้ถูกต้อง' });
    }

    const receipts = await GoodsReceipt.find({ _id: { $in: receiptIds }, status: 'pending_pricing' }).populate('branch');

    if (receipts.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบรายการรับสินค้าที่รอการยืนยัน' });
    }

    const pPrice = Number(purchase_price);
    const sPrice = Number(selling_price);

    for (const receipt of receipts) {
      const { sku, name, brand, model, capacity, color, category } = receipt.productInfo;
      let finalVariation = `${capacity} ${color}`.trim() || 'มาตรฐาน';

      let product = await Product.findOne({ sku });
      if (product) {
        product.name = name;
        product.brand = brand;
        product.model = model;
        product.capacity = capacity;
        product.color = color;
        product.category = category;
        product.purchase_price = pPrice;
        product.selling_price = sPrice;
        await product.save();
      } else {
        product = await Product.create({
          sku,
          name,
          brand,
          model,
          capacity,
          color,
          variation: finalVariation,
          category,
          purchase_price: pPrice,
          selling_price: sPrice,
          images: [],
          hasImei: true
        });
      }

      const newImeis = (receipt.imeiSerials || []).map(s => ({
        imei: s,
        status: 'in_stock',
        received_date: new Date()
      }));

      let stock = await Stock.findOne({ branch: receipt.branch._id, sku });
      if (stock) {
        stock.quantity += Number(receipt.quantity);
        if (newImeis.length > 0) stock.imei_serials.push(...newImeis);
        await stock.save();
      } else {
        stock = await Stock.create({
          branch: receipt.branch._id,
          product: product._id,
          sku,
          quantity: Number(receipt.quantity),
          imei_serials: newImeis,
          import_date: new Date()
        });
      }

      receipt.status = 'confirmed';
      receipt.purchase_price = pPrice;
      receipt.selling_price = sPrice;
      receipt.confirmedBy = req.user._id;
      receipt.confirmedAt = new Date();
      if (remarks) receipt.remarks = remarks.trim();
      await receipt.save();
    }

    res.json({
      success: true,
      message: `ยืนยันและตั้งราคาสินค้าสำเร็จจำนวน ${receipts.length} รายการ สินค้าพร้อมขายหน้าร้านเรียบร้อยแล้ว`
    });
  } catch (err) {
    next(err);
  }
};

// Fetch current user's branch stock ONLY
const getMyBranchStock = async (req, res, next) => {
  try {
    let targetBranchId = req.query.branchId;

    if (req.user.role === 'branch_staff' || !targetBranchId) {
      if (req.user.branch) {
        targetBranchId = req.user.branch._id || req.user.branch;
      }
    }

    if (!targetBranchId) {
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

// Update Goods Receipt (Only if status is pending_pricing)
const updateGoodsReceipt = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const { brand, model, capacity, color, category, imei } = req.body;

    const receipt = await GoodsReceipt.findById(receiptId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการรับสินค้าที่ระบุ' });
    }

    if (receipt.status !== 'pending_pricing') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากรายการนี้ถูกยืนยันเข้าสต็อกเรียบร้อยแล้ว' });
    }

    if (req.user.branch) {
      const userBranchId = String(req.user.branch._id || req.user.branch);
      if (String(receipt.branch) !== userBranchId) {
        return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขรายการของสาขาอื่น' });
      }
    }

    const newImei = imei ? String(imei).trim() : (receipt.productInfo.sku || (receipt.imeiSerials && receipt.imeiSerials[0]));
    
    if (newImei && newImei !== receipt.productInfo.sku) {
      const existingStock = await Stock.findOne({
        $or: [
          { 'imei_serials.imei': newImei },
          { 'sku': newImei }
        ]
      });

      if (existingStock) {
        return res.status(400).json({
          success: false,
          message: `หมายเลขซีเรียล/IMEI (${newImei}) นี้มีอยู่ในระบบคลังสินค้าแล้ว`
        });
      }
    }

    const updatedBrand = (brand || receipt.productInfo.brand).trim();
    const updatedModel = (model || receipt.productInfo.model).trim();
    const updatedCapacity = capacity !== undefined ? capacity.trim() : receipt.productInfo.capacity;
    const updatedColor = color !== undefined ? color.trim() : receipt.productInfo.color;
    const updatedCategory = (category || receipt.productInfo.category).trim();

    const generatedName = generateAutoName(updatedBrand, updatedModel, updatedCapacity, updatedColor);

    receipt.productInfo = {
      sku: newImei,
      name: generatedName,
      brand: updatedBrand,
      model: updatedModel,
      capacity: updatedCapacity,
      color: updatedColor,
      category: updatedCategory
    };
    receipt.imeiSerials = [newImei];
    
    await receipt.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'UPDATE_GOODS_RECEIPT',
      entity: 'GoodsReceipt',
      entityId: receipt._id.toString(),
      details: { receiptNumber: receipt.receiptNumber, sku: newImei, imei: newImei }
    });

    res.json({
      success: true,
      message: 'แก้ไขรายการรับสินค้าเข้าสต็อกสำเร็จ',
      receipt
    });
  } catch (err) {
    next(err);
  }
};

// Delete/Cancel Goods Receipt (Only if status is pending_pricing)
const deleteGoodsReceipt = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const receipt = await GoodsReceipt.findById(receiptId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการรับสินค้าที่ระบุ' });
    }

    if (receipt.status !== 'pending_pricing') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถยกเลิกได้ เนื่องจากรายการนี้ถูกยืนยันเข้าสต็อกเรียบร้อยแล้ว' });
    }

    if (req.user.branch) {
      const userBranchId = String(req.user.branch._id || req.user.branch);
      if (String(receipt.branch) !== userBranchId) {
        return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกรายการของสาขาอื่น' });
      }
    }

    await GoodsReceipt.findByIdAndDelete(receiptId);

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'DELETE_GOODS_RECEIPT',
      entity: 'GoodsReceipt',
      entityId: receiptId,
      details: { receiptNumber: receipt.receiptNumber }
    });

    res.json({
      success: true,
      message: 'ยกเลิก/ลบรายการรับสินค้าเรียบร้อยแล้ว'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  receiveStock,
  getGoodsReceipts,
  confirmGoodsReceipt,
  confirmBatchGoodsReceipts,
  updateGoodsReceipt,
  deleteGoodsReceipt,
  getMyBranchStock,
  getBranchStock,
  getAllBranchStock
};

const Stock = require('../models/Stock');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const GoodsReceipt = require('../models/GoodsReceipt');
const AuditLog = require('../models/AuditLog');
const Role = require('../models/Role');
const BranchPurchaseOrder = require('../models/BranchPurchaseOrder');

// Helper to generate Full Product Name
function generateAutoName(brand = '', model = '', capacity = '', color = '') {
  const parts = [brand, model, capacity, color].map(p => (p || '').trim()).filter(p => p.length > 0);
  return parts.join(' ');
}

// Goods Receipt - Direct Product Info Entry by Branch Staff (Creates GoodsReceipt using IMEI for each unit)
const receiveStock = async (req, res, next) => {
  try {
    let { branchId, items, brand, model, capacity, color, category, quantity, imeiSerials } = req.body;

    let targetBranchId = branchId;
    if (req.user && req.user.branch) {
      targetBranchId = req.user.branch._id || req.user.branch;
    }

    if (!targetBranchId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ สาขาที่รับสินค้าเข้าสต็อก' });
    }

    const branch = await Branch.findById(targetBranchId);
    if (!branch || !branch.isActive) {
      return res.status(404).json({ success: false, message: 'สาขาที่เลือกไม่ถูกต้อง หรือถูกปิดใช้งาน' });
    }

    let normalizedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      items.forEach(it => {
        if (Array.isArray(it.imeiSerials) && it.imeiSerials.length > 0) {
          it.imeiSerials.forEach(im => {
            const cleanIm = String(im).trim();
            if (cleanIm) {
              normalizedItems.push({
                brand: it.brand,
                model: it.model,
                capacity: it.capacity || '',
                color: it.color || '',
                category: it.category,
                imei: cleanIm
              });
            }
          });
        } else if (it.imei) {
          const cleanIm = String(it.imei).trim();
          if (cleanIm) {
            normalizedItems.push({
              brand: it.brand,
              model: it.model,
              capacity: it.capacity || '',
              color: it.color || '',
              category: it.category,
              imei: cleanIm
            });
          }
        }
      });
    } else if (brand && model && category) {
      let cleanSerials = Array.isArray(imeiSerials) ? imeiSerials.map(s => String(s).trim()).filter(Boolean) : [];
      cleanSerials.forEach(cleanIm => {
        normalizedItems.push({
          brand,
          model,
          capacity: capacity || '',
          color: color || '',
          category,
          imei: cleanIm
        });
      });
    }

    if (normalizedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการสินค้าและหมายเลข IMEI อย่างน้อย 1 รายการ' });
    }

    const allSerials = normalizedItems.map(it => it.imei);
    const uniqueInputSerials = new Set(allSerials);
    if (uniqueInputSerials.size !== allSerials.length) {
      return res.status(400).json({ success: false, message: 'พบหมายเลข IMEI ซ้ำซ้อนในรายการที่กรอกเข้ามา' });
    }

    // Check existing stock IMEIs in database
    const existingStockWithSerials = await Stock.find({ imei: { $in: allSerials } });
    
    if (existingStockWithSerials.length > 0) {
      const uniqueDupes = existingStockWithSerials.map(st => st.imei);
      return res.status(400).json({ 
        success: false, 
        message: `พบหมายเลข IMEI มีอยู่ในระบบคลังสินค้าแล้ว: ${uniqueDupes.join(', ')}` 
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const createdReceipts = [];

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const currentImei = item.imei;
      const generatedName = generateAutoName(item.brand, item.model, item.capacity, item.color);
      const receiptNumber = `GR-${branch.code || 'HQ'}-${todayStr}-${randomNum}-${i + 1}`;

      const receipt = await GoodsReceipt.create({
        receiptNumber,
        branch: branch._id,
        receivedBy: req.user._id,
        productInfo: {
          name: generatedName,
          brand: item.brand.trim(),
          model: item.model.trim(),
          capacity: item.capacity ? item.capacity.trim() : '',
          color: item.color ? item.color.trim() : '',
          category: item.category.trim()
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
        details: { receiptNumber: receipt.receiptNumber, branch: branch.name, imei: currentImei }
      });

      createdReceipts.push(receipt);
    }

    res.status(201).json({
      success: true,
      message: `บันทึกรับสินค้าเข้าสต็อกสำเร็จ ${createdReceipts.length} รายการ (บันทึก IMEI เรียบร้อยแล้ว รอฝ่ายจัดซื้อตั้งราคา)`,
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

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || isHqUser;

    if (!isAdminOrHq) {
      if (req.user.branch) {
        query.branch = req.user.branch._id || req.user.branch;
      }
    } else if (branchId) {
      query.branch = branchId;
    }

    const receipts = await GoodsReceipt.find(query)
      .populate('branch', 'name code phone')
      .populate('receivedBy', 'fullName username')
      .populate('confirmedBy', 'fullName username')
      .sort({ createdAt: -1 });

    const products = await Product.find({});
    const productMap = new Map();
    products.forEach(p => {
      const key = `${String(p.brand).trim().toLowerCase()}|${String(p.model).trim().toLowerCase()}|${String(p.capacity || '').trim().toLowerCase()}|${String(p.color || '').trim().toLowerCase()}`;
      productMap.set(key, p);
    });

    const enrichedReceipts = receipts.map(r => {
      const doc = r.toObject();
      if (doc.status === 'pending_pricing') {
        const pInfo = doc.productInfo || {};
        const key = `${String(pInfo.brand).trim().toLowerCase()}|${String(pInfo.model).trim().toLowerCase()}|${String(pInfo.capacity || '').trim().toLowerCase()}|${String(pInfo.color || '').trim().toLowerCase()}`;
        const matchedProd = productMap.get(key);
        if (matchedProd) {
          if (!doc.purchase_price || doc.purchase_price === 0) {
            doc.purchase_price = matchedProd.purchase_price;
          }
          if (!doc.selling_price || doc.selling_price === 0) {
            doc.selling_price = matchedProd.selling_price;
          }
        }
      }
      return doc;
    });

    res.json({
      success: true,
      count: enrichedReceipts.length,
      receipts: enrichedReceipts
    });
  } catch (err) {
    next(err);
  }
};

// Confirm Goods Receipt & Assign Purchase/Selling Prices (Single Item)
const confirmGoodsReceipt = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const { purchase_price, selling_price, remarks, purchaseOrderId } = req.body;

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

    const { name, brand, model, capacity, color, category } = receipt.productInfo;
    const pPrice = Number(purchase_price);
    const sPrice = Number(selling_price);

    let linkedPoInfo = null;

    if (purchaseOrderId) {
      const order = await BranchPurchaseOrder.findById(purchaseOrderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งซื้อสินค้าที่ระบุเพื่อเชื่อมโยง' });
      }
      if (order.status === 'received') {
        return res.status(400).json({ success: false, message: 'ใบสั่งซื้อที่เลือกถูกรับเข้าคลังเรียบร้อยแล้ว ไม่สามารถเชื่อมโยงเพิ่มได้' });
      }
      if (order.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'ใบสั่งซื้อที่เลือกถูกยกเลิกไปแล้ว ไม่สามารถเชื่อมโยงได้' });
      }

      // Match item specs
      const poItem = order.items.find(item => 
        item.brand === brand.trim() && 
        item.model === model.trim() && 
        item.capacity === (capacity || '').trim() && 
        item.color === (color || '').trim() &&
        item.imeis.length < item.quantity
      );

      if (!poItem) {
        return res.status(400).json({ 
          success: false, 
          message: `ไม่พบรายการสินค้าที่ยังต้องการคีย์ IMEI ในใบสั่งซื้อ ${order.orderNumber} ที่ตรงกับสเปกสินค้านี้ (${brand} ${model} ${capacity} ${color})` 
        });
      }

      const targetImeis = (receipt.imeiSerials && receipt.imeiSerials.length > 0) ? receipt.imeiSerials : [];
      for (const cleanImei of targetImeis.map(x => String(x).trim())) {
        if (!poItem.imeis.includes(cleanImei)) {
          poItem.imeis.push(cleanImei);
        }
      }

      const allReceived = order.items.every(item => item.imeis.length === item.quantity);
      if (allReceived) {
        order.status = 'received';
        order.receivedBy = req.user._id;
        order.receivedByName = req.user.fullName || req.user.username;
        order.receivedAt = new Date();
      }

      await order.save();
      receipt.purchaseOrder = order._id;

      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'LINK_RECEIPT_TO_PURCHASE_ORDER',
        entity: 'BranchPurchaseOrder',
        entityId: order._id.toString(),
        details: { 
          orderNumber: order.orderNumber, 
          receiptNumber: receipt.receiptNumber,
          imeis: targetImeis,
          allReceived
        }
      });

      linkedPoInfo = {
        orderNumber: order.orderNumber,
        status: order.status
      };
    }

    // 1. Find or Create Product Master by exact (brand, model, capacity, color)
    let product = await Product.findOne({
      brand: brand.trim(),
      model: model.trim(),
      capacity: (capacity || '').trim(),
      color: (color || '').trim()
    });

    let finalVariation = `${capacity} ${color}`.trim() || 'มาตรฐาน';

    if (product) {
      product.name = name;
      product.purchase_price = pPrice;
      product.selling_price = sPrice;
      if (category) product.category = category;
      await product.save();
    } else {
      product = await Product.create({
        name,
        brand: brand.trim(),
        model: model.trim(),
        capacity: (capacity || '').trim(),
        color: (color || '').trim(),
        variation: finalVariation,
        category: category || 'Smartphones',
        purchase_price: pPrice,
        selling_price: sPrice,
        images: [],
        hasImei: true
      });
    }

    // 2. Add 1 Stock Document per physical device IMEI to the target Branch
    const targetImeis = (receipt.imeiSerials && receipt.imeiSerials.length > 0) ? receipt.imeiSerials : [];

    for (const itemImei of targetImeis) {
      const cleanImei = String(itemImei).trim();
      let stockDoc = await Stock.findOne({ imei: cleanImei });
      if (stockDoc) {
        stockDoc.branch = receipt.branch._id;
        stockDoc.product = product._id;
        stockDoc.productName = name;
        stockDoc.brand = brand.trim();
        stockDoc.model = model.trim();
        stockDoc.capacity = (capacity || '').trim();
        stockDoc.color = (color || '').trim();
        stockDoc.category = category || 'Smartphones';
        stockDoc.purchase_price = pPrice;
        stockDoc.selling_price = sPrice;
        stockDoc.status = 'in_stock';
        await stockDoc.save();
      } else {
        await Stock.create({
          branch: receipt.branch._id,
          product: product._id,
          imei: cleanImei,
          productName: name,
          brand: brand.trim(),
          model: model.trim(),
          capacity: (capacity || '').trim(),
          color: (color || '').trim(),
          category: category || 'Smartphones',
          purchase_price: pPrice,
          selling_price: sPrice,
          status: 'in_stock',
          import_date: new Date()
        });
      }
    }

    // 3. Update GoodsReceipt Status
    receipt.status = 'confirmed';
    receipt.purchase_price = pPrice;
    receipt.selling_price = sPrice;
    receipt.confirmedBy = req.user._id;
    receipt.confirmedAt = new Date();
    let finalRemarks = (remarks || '').trim();
    if (linkedPoInfo) {
      const poRemarkText = `ใบสั่งซื้อเลขที่: ${linkedPoInfo.orderNumber}`;
      if (finalRemarks) {
        receipt.remarks = `${finalRemarks} (${poRemarkText})`;
      } else {
        receipt.remarks = `รายการรับสินค้าจากการสั่งซื้อลงสาขา ${poRemarkText}`;
      }
    } else if (finalRemarks) {
      receipt.remarks = finalRemarks;
    }
    await receipt.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CONFIRM_GOODS_RECEIPT',
      entity: 'GoodsReceipt',
      entityId: receipt._id.toString(),
      details: { receiptNumber: receipt.receiptNumber, imeis: targetImeis, quantity: receipt.quantity, purchase_price: pPrice, selling_price: sPrice }
    });

    res.json({
      success: true,
      message: `ยืนยันรายการรับสินค้า IMEI: ${targetImeis.join(', ')} สำเร็จ สินค้าพร้อมขายหน้าร้านแล้ว` + (linkedPoInfo ? ` (เชื่อมโยงกับใบสั่งซื้อ ${linkedPoInfo.orderNumber} สำเร็จ)` : ''),
      receipt,
      linkedPoInfo
    });
  } catch (err) {
    next(err);
  }
};

// Confirm Goods Receipts in Batch (Confirm multiple items with same prices)
const confirmBatchGoodsReceipts = async (req, res, next) => {
  try {
    const { receiptIds, purchase_price, selling_price, remarks, items } = req.body;

    const batches = items || [
      {
        receiptIds,
        purchase_price,
        selling_price
      }
    ];

    let totalConfirmed = 0;

    for (const batch of batches) {
      const { receiptIds: batchIds, purchase_price: batchPPrice, selling_price: batchSPrice } = batch;

      if (!Array.isArray(batchIds) || batchIds.length === 0) {
        continue;
      }

      if (batchPPrice === undefined || batchSPrice === undefined || Number(batchPPrice) < 0 || Number(batchSPrice) < 0) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุราคาทุนและราคาขายให้ถูกต้อง' });
      }

      const receipts = await GoodsReceipt.find({ _id: { $in: batchIds }, status: 'pending_pricing' }).populate('branch');
      if (receipts.length === 0) {
        continue;
      }

      const pPrice = Number(batchPPrice);
      const sPrice = Number(batchSPrice);

      for (const receipt of receipts) {
        const { name, brand, model, capacity, color, category } = receipt.productInfo;
        let finalVariation = `${capacity} ${color}`.trim() || 'มาตรฐาน';

        let product = await Product.findOne({
          brand: brand.trim(),
          model: model.trim(),
          capacity: (capacity || '').trim(),
          color: (color || '').trim()
        });

        if (product) {
          product.name = name;
          product.purchase_price = pPrice;
          product.selling_price = sPrice;
          if (category) product.category = category;
          await product.save();
        } else {
          product = await Product.create({
            name,
            brand: brand.trim(),
            model: model.trim(),
            capacity: (capacity || '').trim(),
            color: (color || '').trim(),
            variation: finalVariation,
            category: category || 'Smartphones',
            purchase_price: pPrice,
            selling_price: sPrice,
            images: [],
            hasImei: true
          });
        }

        const targetImeis = (receipt.imeiSerials && receipt.imeiSerials.length > 0) ? receipt.imeiSerials : [];

        for (const itemImei of targetImeis) {
          const cleanImei = String(itemImei).trim();
          let stockDoc = await Stock.findOne({ imei: cleanImei });
          if (stockDoc) {
            stockDoc.branch = receipt.branch._id;
            stockDoc.product = product._id;
            stockDoc.productName = name;
            stockDoc.brand = brand.trim();
            stockDoc.model = model.trim();
            stockDoc.capacity = (capacity || '').trim();
            stockDoc.color = (color || '').trim();
            stockDoc.category = category || 'Smartphones';
            stockDoc.purchase_price = pPrice;
            stockDoc.selling_price = sPrice;
            stockDoc.status = 'in_stock';
            await stockDoc.save();
          } else {
            await Stock.create({
              branch: receipt.branch._id,
              product: product._id,
              imei: cleanImei,
              productName: name,
              brand: brand.trim(),
              model: model.trim(),
              capacity: (capacity || '').trim(),
              color: (color || '').trim(),
              category: category || 'Smartphones',
              purchase_price: pPrice,
              selling_price: sPrice,
              status: 'in_stock',
              import_date: new Date()
            });
          }
        }

        receipt.status = 'confirmed';
        receipt.purchase_price = pPrice;
        receipt.selling_price = sPrice;
        receipt.confirmedBy = req.user._id;
        receipt.confirmedAt = new Date();
        if (remarks) receipt.remarks = remarks.trim();
        await receipt.save();
        totalConfirmed++;
      }
    }

    res.json({
      success: true,
      message: `ยืนยันและตั้งราคาสินค้าสำเร็จจำนวน ${totalConfirmed} รายการ สินค้าพร้อมขายหน้าร้านเรียบร้อยแล้ว`
    });
  } catch (err) {
    next(err);
  }
};

// Fetch current user's branch stock ONLY
const getMyBranchStock = async (req, res, next) => {
  try {
    let targetBranchId = req.query.branchId;

    const isHqUser = !req.user.branch || req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || isHqUser;

    if (!targetBranchId) {
      if (isAdminOrHq) {
        targetBranchId = 'all';
      } else if (req.user.branch) {
        targetBranchId = req.user.branch._id || req.user.branch;
      }
    }

    if (!isAdminOrHq) {
      if (req.user.branch) {
        targetBranchId = req.user.branch._id || req.user.branch;
      }
    }

    if (!targetBranchId) {
      const firstBranch = await Branch.findOne({ isActive: true });
      targetBranchId = firstBranch ? firstBranch._id : 'all';
    }

    let branch;
    let stockList;

    if (targetBranchId === 'all') {
      branch = { _id: 'all', name: 'ทุกสาขา' };
      stockList = await Stock.find().populate('product branch');
    } else {
      branch = await Branch.findById(targetBranchId);
      stockList = await Stock.find({ branch: targetBranchId }).populate('product branch');
    }

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
    const stockList = await Stock.find().populate('branch product').sort({ 'branch': 1, 'imei': 1 });

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

    const currentImei = receipt.imeiSerials && receipt.imeiSerials[0] ? receipt.imeiSerials[0] : '';
    const newImei = imei ? String(imei).trim() : currentImei;
    
    if (newImei && newImei !== currentImei) {
      const existingStock = await Stock.findOne({ imei: newImei });

      if (existingStock) {
        return res.status(400).json({
          success: false,
          message: `หมายเลข IMEI (${newImei}) นี้มีอยู่ในระบบคลังสินค้าแล้ว`
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
      details: { receiptNumber: receipt.receiptNumber, imei: newImei }
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

const updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imei, productName, brand, model, capacity, color, category, purchase_price, selling_price, status } = req.body;

    // Check permission from roles
    const roleDoc = await Role.findOne({ code: req.user.role });
    const allowedMenus = roleDoc ? roleDoc.allowedMenus : [];
    if (req.user.role !== 'admin' && !allowedMenus.includes('edit-branch-inventory')) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสินค้าในสาขา' });
    }

    const stock = await Stock.findById(id).populate('branch');
    if (!stock) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการสินค้าที่ต้องการแก้ไข' });
    }

    const oldValues = {};
    const newValues = {};

    const fields = ['imei', 'productName', 'brand', 'model', 'capacity', 'color', 'category', 'purchase_price', 'selling_price', 'status'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const oldVal = stock[field];
        const newVal = req.body[field];
        if (String(oldVal) !== String(newVal)) {
          oldValues[field] = oldVal;
          newValues[field] = newVal;
          stock[field] = newVal;
        }
      }
    }

    if (Object.keys(newValues).length > 0) {
      await stock.save();

      // Create AuditLog
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'EDIT_BRANCH_STOCK',
        entity: 'Stock',
        entityId: stock._id.toString(),
        details: {
          branch: stock.branch ? stock.branch.name : 'ไม่ระบุ',
          productName: stock.productName,
          imei: stock.imei,
          changes: {
            old: oldValues,
            new: newValues
          }
        }
      });
    }

    res.json({
      success: true,
      message: 'แก้ไขข้อมูลสินค้าและบันทึก LOG เรียบร้อยแล้ว',
      stock
    });
  } catch (err) {
    next(err);
  }
};

const releaseStockItems = async (req, res, next) => {
  try {
    const { imeis, remarks } = req.body;

    if (!Array.isArray(imeis) || imeis.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI ที่ต้องการจ่ายออก' });
    }

    // Check permission from roles
    const roleDoc = await Role.findOne({ code: req.user.role });
    const allowedMenus = roleDoc ? roleDoc.allowedMenus : [];
    if (req.user.role !== 'admin' && !allowedMenus.includes('release-stock')) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ทำรายการจ่ายออกสินค้า' });
    }

    const cleanImeis = imeis.map(im => String(im).trim()).filter(Boolean);
    if (cleanImeis.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI ที่ถูกต้อง' });
    }

    const stocks = await Stock.find({ imei: { $in: cleanImeis }, status: 'in_stock' }).populate('branch');
    
    if (stocks.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้าในสต็อกที่มีหมายเลข IMEI ตามที่ระบุ หรือไม่ได้อยู่ในสถานะพร้อมขาย' });
    }

    const results = [];
    let releasedCount = 0;

    // Group by branch to minimize save calls and database roundtrips
    const branchAdjustmentMap = new Map();

    for (const stock of stocks) {
      stock.status = 'released';
      stock.releasedBy = req.user._id;
      stock.releasedByName = req.user.fullName || req.user.username;
      stock.releaseRemark = remarks || '';
      stock.releasedAt = new Date();
      await stock.save();

      const branch = stock.branch;
      if (branch) {
        const bIdStr = branch._id.toString();
        if (!branchAdjustmentMap.has(bIdStr)) {
          branchAdjustmentMap.set(bIdStr, {
            branchDoc: branch,
            refundAmount: 0
          });
        }
        branchAdjustmentMap.get(bIdStr).refundAmount += (stock.purchase_price || 0);
      }

      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'RELEASE_STOCK_ITEM',
        entity: 'Stock',
        entityId: stock._id.toString(),
        details: {
          imei: stock.imei,
          productName: stock.productName,
          purchase_price: stock.purchase_price,
          branchName: branch ? branch.name : 'ไม่ระบุ',
          remarks: remarks || ''
        }
      });

      releasedCount++;
      results.push({ imei: stock.imei, success: true, productName: stock.productName });
    }

    // Apply credit refunds to branches
    for (const adj of branchAdjustmentMap.values()) {
      const { branchDoc, refundAmount } = adj;
      const oldUsed = branchDoc.usedCredit || 0;
      branchDoc.usedCredit = Math.max(0, oldUsed - refundAmount);
      await branchDoc.save();

      // Log branch credit adjustment
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'REFUND_BRANCH_CREDIT_ON_RELEASE',
        entity: 'Branch',
        entityId: branchDoc._id.toString(),
        details: {
          branchName: branchDoc.name,
          refundAmount,
          oldUsedCredit: oldUsed,
          newUsedCredit: branchDoc.usedCredit
        }
      });
    }

    // Find any IMEIs that were not found/released
    const foundImeis = new Set(stocks.map(s => s.imei));
    const missingImeis = cleanImeis.filter(im => !foundImeis.has(im));
    missingImeis.forEach(im => {
      results.push({ imei: im, success: false, reason: 'ไม่พบสินค้าพร้อมขายในระบบ' });
    });

    res.json({
      success: true,
      message: `จ่ายออกสินค้าสำเร็จ ${releasedCount} รายการ และคืนวงเงินเครดิตสาขาเรียบร้อยแล้ว`,
      releasedCount,
      failedCount: missingImeis.length,
      results
    });
  } catch (err) {
    next(err);
  }
};

const getReleasedStockHistory = async (req, res, next) => {
  try {
    const roleDoc = await Role.findOne({ code: req.user.role });
    const allowedMenus = roleDoc ? roleDoc.allowedMenus : [];
    if (req.user.role !== 'admin' && !allowedMenus.includes('release-stock')) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงประวัตินี้' });
    }

    const { branchId, startDate, endDate } = req.query;
    const query = { status: 'released' };

    if (branchId && branchId !== 'all') {
      query.branch = branchId;
    }

    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        dateQuery.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
      query.$or = [
        { releasedAt: dateQuery },
        { releasedAt: null, updatedAt: dateQuery }
      ];
    }

    const stocks = await Stock.find(query)
      .populate('branch', 'name code')
      .sort({ releasedAt: -1, updatedAt: -1 });

    const logs = await AuditLog.find({ action: 'RELEASE_STOCK_ITEM' });
    const logMap = new Map();
    logs.forEach(l => {
      if (l.details && l.details.imei) {
        logMap.set(l.details.imei, l);
      }
    });

    res.json({
      success: true,
      history: stocks.map(st => {
        const matchedLog = logMap.get(st.imei);
        const remark = st.releaseRemark || (matchedLog && matchedLog.details ? matchedLog.details.remarks : '') || '';
        const operatorName = st.releasedByName || (matchedLog ? matchedLog.username : '') || 'ไม่ระบุ';
        const dateCreated = st.releasedAt || (matchedLog ? matchedLog.createdAt : st.updatedAt);
        
        return {
          id: st._id,
          username: operatorName,
          imei: st.imei,
          productName: st.productName,
          purchase_price: st.purchase_price || 0,
          branchName: st.branch ? st.branch.name : 'ไม่ระบุ',
          remarks: remark,
          createdAt: dateCreated
        };
      })
    });
  } catch (err) {
    next(err);
  }
};

const queryImeiDetails = async (req, res, next) => {
  try {
    const { imeis } = req.body;
    if (!Array.isArray(imeis) || imeis.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI ที่ต้องการตรวจสอบ' });
    }
    const cleanImeis = imeis.map(im => String(im).trim()).filter(Boolean);
    const stocks = await Stock.find({ imei: { $in: cleanImeis }, status: 'in_stock' }).populate('branch');
    
    res.json({
      success: true,
      items: stocks.map(st => ({
        imei: st.imei,
        productName: st.productName,
        branchName: st.branch ? st.branch.name : 'ไม่ระบุ',
        purchase_price: st.purchase_price || 0,
        selling_price: st.selling_price || 0
      }))
    });
  } catch (err) {
    next(err);
  }
};

const cancelReleaseStockItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const roleDoc = await Role.findOne({ code: req.user.role });
    const allowedMenus = roleDoc ? roleDoc.allowedMenus : [];
    if (req.user.role !== 'admin' && !allowedMenus.includes('release-stock')) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ยกเลิกรายการจ่ายออกสินค้า' });
    }

    const stock = await Stock.findById(id).populate('branch');
    if (!stock) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการสินค้าที่ระบุ' });
    }

    if (stock.status !== 'released') {
      return res.status(400).json({ success: false, message: 'สินค้านี้ไม่ได้อยู่ในสถานะจ่ายออก' });
    }

    const branch = stock.branch;
    if (branch) {
      branch.usedCredit = (branch.usedCredit || 0) + (stock.purchase_price || 0);
      await branch.save();
      
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'DEDUCT_BRANCH_CREDIT_ON_REVERT_RELEASE',
        entity: 'Branch',
        entityId: branch._id.toString(),
        details: {
          branchName: branch.name,
          deductedAmount: stock.purchase_price,
          newUsedCredit: branch.usedCredit
        }
      });
    }

    stock.status = 'in_stock';
    stock.releasedBy = null;
    stock.releasedByName = '';
    stock.releaseRemark = '';
    stock.releasedAt = null;
    await stock.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CANCEL_RELEASE_STOCK_ITEM',
      entity: 'Stock',
      entityId: stock._id.toString(),
      details: {
        imei: stock.imei,
        productName: stock.productName,
        purchase_price: stock.purchase_price,
        branchName: branch ? branch.name : 'ไม่ระบุ'
      }
    });

    res.json({
      success: true,
      message: `ยกเลิกการจ่ายออกเครื่อง IMEI ${stock.imei} สำเร็จ และหักวงเงินเครดิตของสาขา ${branch ? branch.name : ''} กลับตามเดิมเรียบร้อย`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateStock,
  receiveStock,
  getGoodsReceipts,
  confirmGoodsReceipt,
  confirmBatchGoodsReceipts,
  updateGoodsReceipt,
  deleteGoodsReceipt,
  getMyBranchStock,
  getBranchStock,
  getAllBranchStock,
  releaseStockItems,
  getReleasedStockHistory,
  queryImeiDetails,
  cancelReleaseStockItem
};

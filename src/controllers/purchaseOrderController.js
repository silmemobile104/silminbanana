const BranchPurchaseOrder = require('../models/BranchPurchaseOrder');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const AuditLog = require('../models/AuditLog');
const GoodsReceipt = require('../models/GoodsReceipt');

const getPurchaseOrders = async (req, res, next) => {
  try {
    const { branchId, status } = req.query;
    let query = {};

    if (req.user.role === 'branch_staff') {
      const userBranchId = req.user.branch ? (req.user.branch._id || req.user.branch) : null;
      if (userBranchId) query.branch = userBranchId;
    } else if (branchId) {
      query.branch = branchId;
    }

    if (status) {
      query.status = status;
    }

    const orders = await BranchPurchaseOrder.find(query)
      .populate('branch', 'name code creditLimit usedCredit')
      .populate('orderedBy', 'fullName username')
      .populate('receivedBy', 'fullName username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });
  } catch (err) {
    next(err);
  }
};

const createPurchaseOrder = async (req, res, next) => {
  try {
    const { branchId, items, note } = req.body;

    if (!branchId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุสาขาปลายทางและรายการสินค้าที่สั่งซื้อ' });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขาปลายทาง' });
    }

    // Process items and calculate total cost
    let totalAmount = 0;
    const processedItems = [];

    const generateAutoName = (b = '', m = '', c = '', cl = '') => {
      return [b, m, c, cl].map(p => (p || '').trim()).filter(Boolean).join(' ');
    };

    for (const item of items) {
      let product;
      let brand = (item.brand || '').trim();
      let model = (item.model || '').trim();
      let capacity = (item.capacity || '').trim();
      let color = (item.color || '').trim();
      let productName = item.productName || generateAutoName(brand, model, capacity, color);

      if (item.productId) {
        product = await Product.findById(item.productId);
      }

      if (!product) {
        // Find existing product by catalog specs or auto-create Product document
        let existingProd = await Product.findOne({
          brand: brand || 'General',
          model: model || 'Standard',
          capacity: capacity || '',
          color: color || ''
        });

        if (!existingProd) {
          const cost = Number(item.unitPrice) || 0;
          const sell = 0;
          const varStr = [capacity, color].filter(Boolean).join(' ') || 'Standard';

          existingProd = await Product.create({
            name: productName || 'สินค้าไม่ระบุชื่อ',
            brand: brand || 'General',
            model: model || 'Standard',
            capacity: capacity || '',
            color: color || '',
            variation: varStr,
            category: item.category || 'Smartphones',
            purchase_price: cost,
            selling_price: sell
          });
        }
        product = existingProd;
      }

      const qty = Number(item.quantity) || 1;
      const price = item.unitPrice !== undefined ? Number(item.unitPrice) : (product.purchase_price || 0);
      const itemTotal = qty * price;

      totalAmount += itemTotal;

      processedItems.push({
        product: product._id,
        productName: productName || product.fullName || product.name,
        brand: brand || product.brand,
        model: model || product.model,
        capacity: capacity || product.capacity,
        color: color || product.color,
        quantity: qty,
        unitPrice: price,
        totalPrice: itemTotal,
        imeis: []
      });
    }

    // Check branch remaining credit
    const currentUsed = branch.usedCredit || 0;
    const currentLimit = branch.creditLimit || 0;
    const remainingCredit = currentLimit - currentUsed;

    if (totalAmount > remainingCredit) {
      return res.status(400).json({
        success: false,
        message: `วงเงินสาขาไม่เพียงพอสำหรับสั่งซื้อ! (วงเงินคงเหลือ: ฿${remainingCredit.toLocaleString()}, ยอดสั่งซื้อ: ฿${totalAmount.toLocaleString()})`
      });
    }

    // Deduct credit limit by increasing usedCredit
    branch.usedCredit = currentUsed + totalAmount;
    await branch.save();

    // Generate Order Number
    const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = await BranchPurchaseOrder.countDocuments();
    const orderNumber = `BPO-${datePrefix}-${String(count + 1).padStart(3, '0')}`;

    const newOrder = await BranchPurchaseOrder.create({
      orderNumber,
      branch: branch._id,
      branchName: branch.name,
      items: processedItems,
      totalAmount,
      status: 'pending_imei',
      orderedBy: req.user ? req.user._id : null,
      orderedByName: req.user ? (req.user.fullName || req.user.username) : 'ผู้ดูแลระบบ',
      note: note || ''
    });

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'CREATE_BRANCH_PURCHASE_ORDER',
        entity: 'BranchPurchaseOrder',
        entityId: newOrder._id.toString(),
        details: { orderNumber, branchName: branch.name, totalAmount, creditUsed: branch.usedCredit }
      });
    }

    res.status(201).json({
      success: true,
      message: 'สร้างใบสั่งซื้อสินค้าลงสาขาเรียบร้อย (หักวงเงินสาขาสำเร็จ)',
      order: newOrder,
      branchCreditSummary: {
        creditLimit: branch.creditLimit,
        usedCredit: branch.usedCredit,
        remainingCredit: branch.creditLimit - branch.usedCredit
      }
    });
  } catch (err) {
    next(err);
  }
};

const receivePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // Array of { productId/index, imeis: [String] }

    const order = await BranchPurchaseOrder.findById(id).populate('branch');
    if (!order) {
      return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งซื้อสินค้าที่ระบุ' });
    }

    if (order.status === 'received') {
      return res.status(400).json({ success: false, message: 'ใบสั่งซื้อนี้ได้ถูกสแกนรับเข้าสต็อกเรียบร้อยแล้ว' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการ IMEI สำหรับรับสินค้าเข้าสต็อก' });
    }

    // Validate IMEIs input for each item in PO
    const allInputImeis = [];
    
    for (let i = 0; i < order.items.length; i++) {
      const poItem = order.items[i];
      const match = items.find(it => 
        (it.itemIndex !== undefined && Number(it.itemIndex) === i) ||
        (it._id && String(it._id) === String(poItem._id)) ||
        (it.index !== undefined && Number(it.index) === i)
      ) || items[i];
      
      const imeis = match && Array.isArray(match.imeis) ? match.imeis.map(x => String(x).trim()).filter(Boolean) : [];

      if (imeis.length !== poItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `รายการ ${poItem.productName} ต้องการ IMEI ทั้งหมด ${poItem.quantity} เครื่อง (กรอกมาแล้ว ${imeis.length} เครื่อง)`
        });
      }

      poItem.imeis = imeis;
      allInputImeis.push(...imeis);
    }

    // Check for duplicate IMEIs within input
    const uniqueInput = new Set(allInputImeis);
    if (uniqueInput.size !== allInputImeis.length) {
      return res.status(400).json({ success: false, message: 'พบหมายเลข IMEI ซ้ำกันในรายการที่สแกนกรอก' });
    }

    // Check if any IMEI already exists in Stock
    const existingStocks = await Stock.find({ imei: { $in: allInputImeis } });
    if (existingStocks.length > 0) {
      const dupImeis = existingStocks.map(s => s.imei);
      return res.status(400).json({
        success: false,
        message: `หมายเลข IMEI ดังต่อไปนี้มีอยู่ในระบบคลังสินค้าแล้ว: ${dupImeis.join(', ')}`
      });
    }

    // Auto-create GoodsReceipt documents (1 record per physical device/IMEI) for Stock Verification menu
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    for (let idx = 0; idx < order.items.length; idx++) {
      const poItem = order.items[idx];
      let prodDoc = await Product.findById(poItem.product);

      let brand = poItem.brand || (prodDoc ? prodDoc.brand : 'General');
      let model = poItem.model || (prodDoc ? prodDoc.model : 'Standard');
      let capacity = poItem.capacity || (prodDoc ? prodDoc.capacity : '');
      let color = poItem.color || (prodDoc ? prodDoc.color : '');
      let productName = poItem.productName || (prodDoc ? prodDoc.name : [brand, model, capacity, color].filter(Boolean).join(' '));
      let category = (prodDoc ? prodDoc.category : 'Smartphones') || 'Smartphones';

      const costPrice = poItem.unitPrice || (prodDoc ? prodDoc.purchase_price : 0);
      const sellingPrice = 0;

      for (let imIdx = 0; imIdx < (poItem.imeis || []).length; imIdx++) {
        const currentImei = poItem.imeis[imIdx];
        const receiptNumber = `GR-BPO-${dateStr}-${order.orderNumber.replace(/[^0-9]/g, '').slice(-4)}-${idx + 1}-${imIdx + 1}`;

        await GoodsReceipt.create({
          receiptNumber,
          branch: order.branch._id,
          receivedBy: req.user ? req.user._id : (order.orderedBy || order.branch._id),
          productInfo: {
            name: productName,
            brand,
            model,
            capacity,
            color,
            category
          },
          quantity: 1,
          imeiSerials: [currentImei],
          purchase_price: costPrice,
          selling_price: sellingPrice,
          status: 'pending_pricing',
          remarks: `รายการรับสินค้าจากการสั่งซื้อลงสาขา ใบสั่งซื้อเลขที่: ${order.orderNumber}`
        });
      }
    }

    // Mark PO as received
    order.status = 'received';
    order.receivedBy = req.user ? req.user._id : null;
    order.receivedByName = req.user ? (req.user.fullName || req.user.username) : 'พนักงานสาขา';
    order.receivedAt = new Date();
    await order.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'RECEIVE_BRANCH_PURCHASE_ORDER',
        entity: 'BranchPurchaseOrder',
        entityId: order._id.toString(),
        details: { orderNumber: order.orderNumber, branchName: order.branchName, totalImeis: allInputImeis.length }
      });
    }

    res.json({
      success: true,
      message: `รับสินค้าเข้าสต็อกสาขา ${order.branchName} เรียบร้อยแล้ว (${allInputImeis.length} เครื่อง)`
    });
  } catch (err) {
    next(err);
  }
};

const getPurchaseOrderById = async (req, res, next) => {
  try {
    const order = await BranchPurchaseOrder.findById(req.params.id)
      .populate('branch')
      .populate('orderedBy', 'fullName username')
      .populate('receivedBy', 'fullName username');

    if (!order) {
      return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งซื้อสินค้าที่ระบุ' });
    }

    res.json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
};

const updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, note } = req.body;

    const order = await BranchPurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งซื้อสินค้าที่ระบุ' });
    }

    if (order.status === 'received') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากรายการนี้รับสินค้าเข้าสต็อกเรียบร้อยแล้ว' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถแก้ไขใบสั่งซื้อที่ถูกยกเลิกไปแล้ว' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการสินค้าที่สั่งซื้ออย่างน้อย 1 รายการ' });
    }

    const branch = await Branch.findById(order.branch);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขา' });
    }

    // Process items & calculate new total amount
    let newTotalAmount = 0;
    const processedItems = [];

    const generateAutoName = (b = '', m = '', c = '', cl = '') => {
      return [b, m, c, cl].map(p => (p || '').trim()).filter(Boolean).join(' ');
    };

    for (const item of items) {
      let product;
      let brand = (item.brand || '').trim();
      let model = (item.model || '').trim();
      let capacity = (item.capacity || '').trim();
      let color = (item.color || '').trim();
      let productName = item.productName || generateAutoName(brand, model, capacity, color);

      if (item.productId) {
        product = await Product.findById(item.productId);
      }

      if (!product) {
        let existingProd = await Product.findOne({
          brand: brand || 'General',
          model: model || 'Standard',
          capacity: capacity || '',
          color: color || ''
        });

        if (!existingProd) {
          const cost = Number(item.unitPrice) || 0;
          const sell = 0;
          const varStr = [capacity, color].filter(Boolean).join(' ') || 'Standard';

          existingProd = await Product.create({
            name: productName || 'สินค้าไม่ระบุชื่อ',
            brand: brand || 'General',
            model: model || 'Standard',
            capacity: capacity || '',
            color: color || '',
            variation: varStr,
            category: item.category || 'Smartphones',
            purchase_price: cost,
            selling_price: sell
          });
        }
        product = existingProd;
      }

      const qty = Number(item.quantity) || 1;
      const price = item.unitPrice !== undefined ? Number(item.unitPrice) : (product.purchase_price || 0);
      const itemTotal = qty * price;

      newTotalAmount += itemTotal;

      processedItems.push({
        product: product._id,
        productName: productName || product.fullName || product.name,
        brand: brand || product.brand,
        model: model || product.model,
        capacity: capacity || product.capacity,
        color: color || product.color,
        quantity: qty,
        unitPrice: price,
        totalPrice: itemTotal,
        imeis: []
      });
    }

    // Check credit difference and adjust branch usedCredit
    const oldTotalAmount = order.totalAmount || 0;
    const diff = newTotalAmount - oldTotalAmount;

    if (diff > 0) {
      const currentUsed = branch.usedCredit || 0;
      const creditLimit = branch.creditLimit || 0;
      const remainingCredit = creditLimit - currentUsed;

      if (diff > remainingCredit) {
        return res.status(400).json({
          success: false,
          message: `วงเงินสาขาไม่เพียงพอสำหรับการแก้ไข! (ต้องการวงเงินเพิ่ม ฿${diff.toLocaleString()} แต่วงเงินคงเหลือมีเพียง ฿${remainingCredit.toLocaleString()})`
        });
      }
    }

    branch.usedCredit = Math.max(0, (branch.usedCredit || 0) + diff);
    await branch.save();

    order.items = processedItems;
    order.totalAmount = newTotalAmount;
    if (note !== undefined) order.note = note;
    await order.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'UPDATE_BRANCH_PURCHASE_ORDER',
        entity: 'BranchPurchaseOrder',
        entityId: order._id.toString(),
        details: { orderNumber: order.orderNumber, oldTotalAmount, newTotalAmount }
      });
    }

    res.json({
      success: true,
      message: `แก้ไขใบสั่งซื้อ ${order.orderNumber} สำเร็จ`,
      order
    });
  } catch (err) {
    next(err);
  }
};

const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await BranchPurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'ไม่พบใบสั่งซื้อสินค้าที่ระบุ' });
    }

    if (order.status === 'received') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถยกเลิกได้ เนื่องจากรับสินค้าเข้าสต็อกเรียบร้อยแล้ว' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'ใบสั่งซื้อนี้ถูกยกเลิกไปแล้ว' });
    }

    // Refund branch used credit
    const branch = await Branch.findById(order.branch);
    if (branch) {
      branch.usedCredit = Math.max(0, (branch.usedCredit || 0) - (order.totalAmount || 0));
      await branch.save();
    }

    order.status = 'cancelled';
    await order.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'CANCEL_BRANCH_PURCHASE_ORDER',
        entity: 'BranchPurchaseOrder',
        entityId: order._id.toString(),
        details: { orderNumber: order.orderNumber, refundedAmount: order.totalAmount }
      });
    }

    res.json({
      success: true,
      message: `ยกเลิกใบสั่งซื้อ ${order.orderNumber} และคืนวงเงินสาขา ฿${(order.totalAmount || 0).toLocaleString()} สำเร็จ`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder
};

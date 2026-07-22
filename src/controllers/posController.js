const Sale = require('../models/Sale');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

// Process POS Checkout & Stock Deduction
const createSale = async (req, res, next) => {
  try {
    const { branchId, customer, items, paymentMethod, receivedAmount, discountTotal = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรายการสินค้าในตะกร้าอย่างน้อย 1 รายการ' });
    }

    const branch = await Branch.findById(branchId || (req.user.branch ? req.user.branch._id : null));
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขาที่ทำรายการ' });
    }

    let calculatedSubtotal = 0;
    const saleItems = [];

    // Process each item and deduct stock
    for (const item of items) {
      const stock = await Stock.findOne({ branch: branch._id, product: item.productId });
      if (!stock || stock.quantity < (item.quantity || 1)) {
        return res.status(400).json({
          success: false,
          message: `สินค้า SKU "${item.sku}" ในสาขา ${branch.name} มีจำนวนคงเหลือไม่เพียงพอ (คงเหลือ: ${stock ? stock.quantity : 0} ชิ้น)`
        });
      }

      // If IMEI is specified, check IMEI availability in stock
      if (item.imei) {
        const imeiItem = stock.imei_serials.find(i => i.imei === item.imei && i.status === 'in_stock');
        if (!imeiItem) {
          return res.status(400).json({
            success: false,
            message: `หมายเลข IMEI "${item.imei}" สำหรับสินค้า SKU "${item.sku}" ไม่พร้อมจำหน่ายหรือถูกขายไปแล้ว`
          });
        }
        // Mark IMEI as sold
        imeiItem.status = 'sold';
        imeiItem.sold_date = new Date();
      }

      // Deduct stock quantity
      stock.quantity -= (item.quantity || 1);
      await stock.save();

      const itemTotal = (item.unitPrice * (item.quantity || 1)) - (item.discount || 0);
      calculatedSubtotal += (item.unitPrice * (item.quantity || 1));

      saleItems.push({
        product: item.productId,
        sku: item.sku,
        productName: item.productName,
        imei: item.imei || '',
        unitPrice: item.unitPrice,
        quantity: item.quantity || 1,
        discount: item.discount || 0,
        totalPrice: itemTotal
      });
    }

    const grandTotal = calculatedSubtotal - (discountTotal || 0);
    const numReceived = Number(receivedAmount) || grandTotal;
    const changeAmount = Math.max(0, numReceived - grandTotal);

    // Auto-generate Receipt Number: INV-{BranchCode}-{YYYYMMDD}-{4DigitRandom}
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `INV-${branch.code || 'HQ'}-${todayStr}-${randomNum}`;

    const sale = await Sale.create({
      receiptNumber,
      branch: branch._id,
      soldBy: req.user._id,
      customer: {
        name: customer && customer.name ? customer.name.trim() : 'ลูกค้าทั่วไป',
        phone: customer && customer.phone ? customer.phone.trim() : '-',
        taxId: customer && customer.taxId ? customer.taxId.trim() : ''
      },
      items: saleItems,
      subtotal: calculatedSubtotal,
      discountTotal: Number(discountTotal) || 0,
      grandTotal,
      paymentMethod: paymentMethod || 'cash',
      receivedAmount: numReceived,
      changeAmount
    });

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_POS_SALE',
      entity: 'Sale',
      entityId: sale._id.toString(),
      details: { receiptNumber: sale.receiptNumber, grandTotal: sale.grandTotal, branch: branch.name }
    });

    // Populate branch and seller details for receipt printing
    const populatedSale = await Sale.findById(sale._id)
      .populate('branch')
      .populate('soldBy', 'fullName username email empId');

    res.status(201).json({
      success: true,
      message: `บันทึกการขายสำเร็จ เลขที่ใบเสร็จ: ${sale.receiptNumber}`,
      sale: populatedSale
    });
  } catch (err) {
    next(err);
  }
};

// Get Sale Receipt Details by ID
const getSaleReceipt = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('branch')
      .populate('soldBy', 'fullName username email empId');

    if (!sale) {
      return res.status(404).json({ success: false, message: 'ไม่พบใบเสร็จรับเงินที่ต้องการ' });
    }

    res.json({ success: true, sale });
  } catch (err) {
    next(err);
  }
};

// Get Sales History
const getSalesHistory = async (req, res, next) => {
  try {
    let query = { status: 'completed' };

    // Branch filter: sales staff see only their branch
    if (['branch_staff', 'technical_staff'].includes(req.user.role)) {
      if (req.user.branch) {
        query.branch = req.user.branch;
      }
    } else if (req.query.branchId) {
      query.branch = req.query.branchId;
    }

    const sales = await Sale.find(query)
      .populate('branch', 'name code phone')
      .populate('soldBy', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: sales.length,
      sales
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSale,
  getSaleReceipt,
  getSalesHistory
};

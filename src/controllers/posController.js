const Sale = require('../models/Sale');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

// Process POS Checkout & Stock Deduction
const createSale = async (req, res, next) => {
  try {
    const { branchId, customer, items, paymentMethod, receivedAmount, discountTotal = 0, financeCompanyName } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรายการสินค้าในตะกร้าอย่างน้อย 1 รายการ' });
    }

    const branch = await Branch.findById(branchId || (req.user.branch ? req.user.branch._id : null));
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขาที่ทำรายการ' });
    }

    let calculatedSubtotal = 0;
    let calculatedTotalCost = 0;
    const saleItems = [];

    // Process each item, calculate cost/profit, and deduct stock
    for (const item of items) {
      const [stock, product] = await Promise.all([
        Stock.findOne({ branch: branch._id, product: item.productId }),
        Product.findById(item.productId)
      ]);

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

      const costPrice = product ? (product.purchase_price || 0) : (item.costPrice || 0);
      const qty = item.quantity || 1;
      const itemTotal = (item.unitPrice * qty) - (item.discount || 0);
      const itemCostTotal = costPrice * qty;
      const itemProfit = itemTotal - itemCostTotal;

      calculatedSubtotal += (item.unitPrice * qty);
      calculatedTotalCost += itemCostTotal;

      saleItems.push({
        product: item.productId,
        sku: item.sku,
        productName: item.productName,
        imei: item.imei || '',
        costPrice,
        unitPrice: item.unitPrice,
        quantity: qty,
        discount: item.discount || 0,
        totalPrice: itemTotal,
        profit: itemProfit
      });
    }

    const grandTotal = calculatedSubtotal - (discountTotal || 0);
    const totalProfit = grandTotal - calculatedTotalCost;

    let numReceived = Number(receivedAmount) || grandTotal;
    let changeAmount = Math.max(0, numReceived - grandTotal);
    let financeDetails = {
      companyName: '',
      payoutStatus: 'not_applicable',
      payoutReceivedDate: null,
      payoutRemarks: ''
    };

    if (paymentMethod === 'finance') {
      financeDetails = {
        companyName: financeCompanyName ? financeCompanyName.trim() : 'ไม่ระบุชื่อไฟแนนซ์',
        payoutStatus: 'pending_payout',
        payoutReceivedDate: null,
        payoutRemarks: ''
      };
      numReceived = grandTotal;
      changeAmount = 0;
    }

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
      totalCost: calculatedTotalCost,
      totalProfit,
      paymentMethod: paymentMethod || 'cash',
      financeDetails,
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
      details: { receiptNumber: sale.receiptNumber, grandTotal: sale.grandTotal, branch: branch.name, paymentMethod }
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

// Get Finance & Profit Reports
const getFinanceProfitReport = async (req, res, next) => {
  try {
    const { branchId, startDate, endDate, paymentMethod, payoutStatus } = req.query;

    let query = { status: 'completed' };

    // Branch filtering
    if (['branch_staff', 'technical_staff'].includes(req.user.role)) {
      if (req.user.branch) {
        query.branch = req.user.branch._id || req.user.branch;
      }
    } else if (branchId) {
      query.branch = branchId;
    }

    // Date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Payout status filter
    if (payoutStatus) {
      query['financeDetails.payoutStatus'] = payoutStatus;
    }

    const sales = await Sale.find(query)
      .populate('branch', 'name code phone')
      .populate('soldBy', 'fullName username')
      .sort({ createdAt: -1 });

    // Calculate Summary Statistics
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    let cashRevenue = 0;
    let cashProfit = 0;

    let financeRevenue = 0;
    let financeProfit = 0;

    let pendingFinanceAmount = 0;
    let receivedFinanceAmount = 0;
    let pendingFinanceCount = 0;

    sales.forEach(sale => {
      // If sale totalCost is 0 (legacy record), fallback cost from items or calculate
      let sCost = sale.totalCost || 0;
      if (!sCost && sale.items && sale.items.length > 0) {
        sCost = sale.items.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      }
      let sProfit = sale.totalProfit || (sale.grandTotal - sCost);

      totalRevenue += sale.grandTotal;
      totalCost += sCost;
      totalProfit += sProfit;

      if (sale.paymentMethod === 'finance') {
        financeRevenue += sale.grandTotal;
        financeProfit += sProfit;

        if (sale.financeDetails && sale.financeDetails.payoutStatus === 'pending_payout') {
          pendingFinanceAmount += sProfit;
          pendingFinanceCount++;
        } else if (sale.financeDetails && sale.financeDetails.payoutStatus === 'received') {
          receivedFinanceAmount += sProfit;
        }
      } else {
        cashRevenue += sale.grandTotal;
        cashProfit += sProfit;
      }
    });

    res.json({
      success: true,
      summary: {
        totalSalesCount: sales.length,
        totalRevenue,
        totalCost,
        totalProfit,
        cashRevenue,
        cashProfit,
        financeRevenue,
        financeProfit,
        pendingFinanceAmount,
        receivedFinanceAmount,
        pendingFinanceCount
      },
      sales
    });
  } catch (err) {
    next(err);
  }
};

// Update Finance Payout Status & Received Date
const updateFinancePayoutStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payoutReceivedDate, payoutRemarks } = req.body;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการขายที่ต้องการอัปเดต' });
    }

    if (sale.paymentMethod !== 'finance') {
      return res.status(400).json({ success: false, message: 'รายการขายนี้ไม่ใช่การชำระแบบจัดไฟแนนซ์' });
    }

    const receivedDate = payoutReceivedDate ? new Date(payoutReceivedDate) : new Date();

    sale.financeDetails.payoutStatus = 'received';
    sale.financeDetails.payoutReceivedDate = receivedDate;
    if (payoutRemarks !== undefined) {
      sale.financeDetails.payoutRemarks = payoutRemarks.trim();
    }

    await sale.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'UPDATE_FINANCE_PAYOUT',
      entity: 'Sale',
      entityId: sale._id.toString(),
      details: { receiptNumber: sale.receiptNumber, grandTotal: sale.grandTotal, payoutReceivedDate: receivedDate }
    });

    const populatedSale = await Sale.findById(sale._id)
      .populate('branch')
      .populate('soldBy', 'fullName username');

    res.json({
      success: true,
      message: `บันทึกการรับเงินจากไฟแนนซ์เรียบร้อยแล้ว (เลขที่ใบเสร็จ: ${sale.receiptNumber})`,
      sale: populatedSale
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSale,
  getSaleReceipt,
  getSalesHistory,
  getFinanceProfitReport,
  updateFinancePayoutStatus
};

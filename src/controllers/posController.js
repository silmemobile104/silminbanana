const Sale = require('../models/Sale');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const Role = require('../models/Role');

// Process POS Checkout & Stock Deduction (Atomic checkout per IMEI)
const createSale = async (req, res, next) => {
  try {
    const { branchId, customer, items, paymentMethod, receivedAmount, discountTotal = 0, financeCompanyName } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรายการสินค้าในตะกร้าอย่างน้อย 1 รายการ' });
    }

    let branch = null;
    if (branchId && branchId !== 'all') {
      branch = await Branch.findById(branchId);
      if (!branch) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขาที่ทำรายการ' });
      }
    }

    let calculatedSubtotal = 0;
    let calculatedTotalCost = 0;
    const saleItems = [];

    // Process each item, calculate cost/profit, and mark 1-to-1 Stock Document as sold atomically
    for (const item of items) {
      const targetImei = String(item.imei || '').trim();
      
      if (!targetImei) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุหมายเลข IMEI สำหรับสินค้าทุกรายการ' });
      }

      // Atomic find and mark sold
      let stockItem;
      if (branch) {
        stockItem = await Stock.findOneAndUpdate(
          { branch: branch._id, imei: targetImei, status: 'in_stock' },
          { $set: { status: 'sold', sold_date: new Date() } },
          { new: true }
        ).populate('product');
      } else {
        stockItem = await Stock.findOneAndUpdate(
          { imei: targetImei, status: 'in_stock' },
          { $set: { status: 'sold', sold_date: new Date() } },
          { new: true }
        ).populate('product');
      }

      if (!stockItem) {
        return res.status(400).json({
          success: false,
          message: `หมายเลข IMEI "${targetImei}" ไม่พบในคลัง${branch ? 'สาขา ' + branch.name : 'ระบบ'} หรือถูกขายไปแล้ว`
        });
      }

      if (!branch) {
        branch = await Branch.findById(stockItem.branch);
      }

      const costPrice = stockItem.purchase_price !== undefined ? stockItem.purchase_price : (item.costPrice || 0);
      const qty = 1;
      const itemTotal = (item.unitPrice * qty) - (item.discount || 0);
      const itemCostTotal = costPrice * qty;
      const itemProfit = itemTotal - itemCostTotal;

      calculatedSubtotal += (item.unitPrice * qty);
      calculatedTotalCost += itemCostTotal;

      saleItems.push({
        product: stockItem.product ? stockItem.product._id : null,
        productName: stockItem.productName || item.productName,
        imei: stockItem.imei,
        costPrice,
        unitPrice: item.unitPrice,
        quantity: 1,
        discount: item.discount || 0,
        totalPrice: itemTotal,
        profit: itemProfit
      });
    }

    if (!branch) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลสาขาสำหรับการขายนี้' });
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

    const isFinance = paymentMethod === 'finance';

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
      changeAmount,
      costReturnedStatus: isFinance ? 'not_applicable' : 'pending'
    });

    // If payment method is finance, restore branch credit limit by totalCost immediately!
    if (isFinance) {
      const currentUsed = branch.usedCredit || 0;
      branch.usedCredit = Math.max(0, currentUsed - calculatedTotalCost);
      await branch.save();
    }

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_POS_SALE',
      entity: 'Sale',
      entityId: sale._id.toString(),
      details: {
        receiptNumber: sale.receiptNumber,
        grandTotal: sale.grandTotal,
        branch: branch.name,
        paymentMethod,
        creditRefunded: isFinance ? calculatedTotalCost : 0,
        newUsedCredit: branch.usedCredit
      }
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
    let query = {};

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || isHqUser;

    if (!isAdminOrHq) {
      if (req.user.branch) {
        query.branch = req.user.branch._id || req.user.branch;
      }
    } else if (req.query.branchId && req.query.branchId !== 'all') {
      query.branch = req.query.branchId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const sales = await Sale.find(query)
      .populate('branch', 'name code phone')
      .populate('soldBy', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(200);

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

// Executive Dashboard Analytics
const getExecutiveDashboard = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todaySales, allStock, branches] = await Promise.all([
      Sale.find({ createdAt: { $gte: todayStart, $lte: todayEnd } }).populate('branch'),
      Stock.find({ status: 'in_stock' }).populate('product').populate('branch'),
      Branch.find({ isActive: true })
    ]);

    // 1. Calculate Today's Sales KPIs
    let todayRevenue = 0;
    let todayProfit = 0;
    let todayCashRevenue = 0;
    let todayFinanceRevenue = 0;
    let todayBills = todaySales.length;

    const branchSalesMap = {};
    branches.forEach(b => {
      branchSalesMap[b._id.toString()] = {
        branchId: b._id,
        name: b.name,
        code: b.code,
        revenue: 0,
        bills: 0,
        stockItems: 0,
        stockValue: 0
      };
    });

    todaySales.forEach(s => {
      todayRevenue += s.grandTotal || 0;
      todayProfit += s.totalProfit || 0;
      if (s.paymentMethod === 'finance') {
        todayFinanceRevenue += s.grandTotal || 0;
      } else {
        todayCashRevenue += s.grandTotal || 0;
      }

      if (s.branch && branchSalesMap[s.branch._id.toString()]) {
        branchSalesMap[s.branch._id.toString()].revenue += s.grandTotal || 0;
        branchSalesMap[s.branch._id.toString()].bills += 1;
      }
    });

    // 2. Stock KPIs & Low Stock Alerts
    let totalStockItems = 0;
    let totalStockValue = 0;
    let totalStockCost = 0;
    const lowStockAlerts = [];

    const branchProductCount = {};

    allStock.forEach(st => {
      const qty = 1;
      const sellPrice = st.selling_price || (st.product ? st.product.selling_price : 0);
      const buyPrice = st.purchase_price || (st.product ? st.product.purchase_price : 0);

      totalStockItems += qty;
      totalStockValue += sellPrice;
      totalStockCost += buyPrice;

      if (st.branch) {
        const bIdStr = st.branch._id.toString();
        if (branchSalesMap[bIdStr]) {
          branchSalesMap[bIdStr].stockItems += qty;
          branchSalesMap[bIdStr].stockValue += sellPrice;
        }

        if (st.product) {
          const pIdStr = st.product._id.toString();
          const key = `${bIdStr}_${pIdStr}`;
          if (!branchProductCount[key]) {
            branchProductCount[key] = {
              branchId: bIdStr,
              branchName: st.branch.name,
              productId: pIdStr,
              productName: st.productName || st.product.name || 'สินค้าไม่ระบุชื่อ',
              quantity: 0
            };
          }
          branchProductCount[key].quantity += 1;
        }
      }
    });

    // Filter products with stock <= 2
    Object.values(branchProductCount).forEach(item => {
      if (item.quantity <= 2) {
        lowStockAlerts.push(item);
      }
    });

    // Sort ascending by quantity so lowest stock items show first
    lowStockAlerts.sort((a, b) => a.quantity - b.quantity);

    // 3. Top Selling Products
    const productSalesCount = {};
    todaySales.forEach(s => {
      (s.items || []).forEach(it => {
        const pName = it.productName || it.imei;
        if (!productSalesCount[pName]) {
          productSalesCount[pName] = { productName: pName, quantity: 0, revenue: 0 };
        }
        productSalesCount[pName].quantity += (it.quantity || 1);
        productSalesCount[pName].revenue += (it.totalPrice || 0);
      });
    });

    const topSellingProducts = Object.values(productSalesCount)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 4. Recent Sales Transactions
    const recentSales = todaySales.slice(-5).reverse().map(s => ({
      receiptNumber: s.receiptNumber,
      branchName: s.branch ? s.branch.name : '-',
      customerName: s.customer ? s.customer.name : 'ลูกค้าทั่วไป',
      grandTotal: s.grandTotal,
      paymentMethod: s.paymentMethod,
      time: new Date(s.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }));

    res.json({
      success: true,
      executiveStats: {
        todayRevenue,
        todayProfit,
        todayBills,
        todayCashRevenue,
        todayFinanceRevenue,
        totalStockItems,
        totalStockValue,
        totalStockCost,
        branchPerformance: Object.values(branchSalesMap),
        topSellingProducts,
        lowStockAlerts: lowStockAlerts.slice(0, 10),
        recentSales
      }
    });
  } catch (err) {
    next(err);
  }
};

// Executive Report Range API
const getExecutiveReportRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [sales, branches] = await Promise.all([
      Sale.find({ createdAt: { $gte: start, $lte: end } }).populate('branch').populate('soldBy', 'fullName username'),
      Branch.find({ isActive: true })
    ]);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalBills = sales.length;
    let cashRevenue = 0;
    let financeRevenue = 0;

    const branchSummaryMap = {};
    branches.forEach(b => {
      branchSummaryMap[b._id.toString()] = {
        branchId: b._id,
        name: b.name,
        code: b.code,
        revenue: 0,
        cost: 0,
        profit: 0,
        bills: 0
      };
    });

    const productSalesMap = {};

    sales.forEach(s => {
      const gTotal = s.grandTotal || 0;
      let sCost = s.totalCost || 0;
      if (!sCost && s.items && s.items.length > 0) {
        sCost = s.items.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      }
      let sProfit = s.totalProfit || (gTotal - sCost);

      totalRevenue += gTotal;
      totalCost += sCost;
      totalProfit += sProfit;

      if (s.paymentMethod === 'finance') {
        financeRevenue += gTotal;
      } else {
        cashRevenue += gTotal;
      }

      if (s.branch && branchSummaryMap[s.branch._id.toString()]) {
        const bItem = branchSummaryMap[s.branch._id.toString()];
        bItem.revenue += gTotal;
        bItem.cost += sCost;
        bItem.profit += sProfit;
        bItem.bills += 1;
      }

      (s.items || []).forEach(it => {
        const key = it.productName || it.imei;
        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            productName: key,
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        const qty = it.quantity || 1;
        const rev = it.totalPrice || 0;
        const prof = it.profit || (rev - ((it.costPrice || 0) * qty));

        productSalesMap[key].quantity += qty;
        productSalesMap[key].revenue += rev;
        productSalesMap[key].profit += prof;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const averageOrderValue = totalBills > 0 ? (totalRevenue / totalBills) : 0;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;

    res.json({
      success: true,
      reportPeriod: { startDate, endDate },
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin,
        totalBills,
        averageOrderValue,
        cashRevenue,
        financeRevenue,
        branchPerformance: Object.values(branchSummaryMap),
        topProducts
      }
    });
  } catch (err) {
    next(err);
  }
};

const returnCostToHq = async (req, res, next) => {
  try {
    const { saleId } = req.params;
    const { payoutReceivedDate, remarks } = req.body;

    const dateVal = payoutReceivedDate || new Date();

    const sale = await Sale.findById(saleId).populate('branch');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการบิลขาย' });
    }

    if (sale.status === 'voided') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถโอนคืนต้นทุนสำหรับบิลขายที่ถูกยกเลิกแล้ว' });
    }

    if (sale.costReturnedStatus === 'returned') {
      return res.status(400).json({ success: false, message: 'รายการนี้ได้รับการโอนคืนต้นทุนแล้ว' });
    }

    if (sale.paymentMethod === 'finance') {
      return res.status(400).json({ success: false, message: 'รายการจัดไฟแนนซ์คืนวงเงินอัตโนมัติแล้ว ไม่ต้องโอนคืนซ้ำ' });
    }

    sale.costReturnedStatus = 'returned';
    sale.costReturnedDate = dateVal;
    if (remarks !== undefined) {
      sale.costReturnedRemarks = remarks;
    }
    await sale.save();

    // Adjust branch used credit (restoring credit limit by reducing usedCredit)
    const branch = sale.branch;
    if (branch) {
      const currentUsed = branch.usedCredit || 0;
      const refundAmount = sale.totalCost || 0;
      branch.usedCredit = Math.max(0, currentUsed - refundAmount);
      await branch.save();
    }

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'RETURN_COST_TO_HQ',
      entity: 'Sale',
      entityId: sale._id.toString(),
      details: {
        receiptNumber: sale.receiptNumber,
        branch: branch ? branch.name : 'ไม่ระบุ',
        refundAmount: sale.totalCost,
        newUsedCredit: branch ? branch.usedCredit : 0
      }
    });

    res.json({
      success: true,
      message: 'บันทึกโอนยอดต้นทุนคืนบริษัทใหญ่ และคืนวงเงินสาขาเรียบร้อยแล้ว',
      sale
    });
  } catch (err) {
    next(err);
  }
};

const voidSale = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการขายที่ต้องการยกเลิก' });
    }

    if (sale.status === 'voided') {
      return res.status(400).json({ success: false, message: 'รายการขายนี้ถูกยกเลิกไปแล้ว' });
    }

    // Role Doc check
    const roleDoc = await Role.findOne({ code: req.user.role });
    const allowedMenus = roleDoc ? (roleDoc.allowedMenus || []) : [];
    const hasVoidPermission = req.user.role === 'admin' || allowedMenus.includes('void-sale');

    if (!hasVoidPermission) {
      return res.status(403).json({ success: false, message: 'ตำแหน่งงานของคุณไม่มีสิทธิ์ในการยกเลิกรายการขาย' });
    }

    // Restore stock status from 'sold' to 'in_stock'
    const imeis = sale.items.map(item => item.imei).filter(Boolean);
    if (imeis.length > 0) {
      await Stock.updateMany(
        { imei: { $in: imeis }, status: 'sold' },
        { $set: { status: 'in_stock', sold_date: null } }
      );
    }

    // Revert branch credit limit if credit was restored
    const branch = await Branch.findById(sale.branch);
    let creditReverted = 0;
    if (branch) {
      const restoredCredit = sale.paymentMethod === 'finance' || sale.costReturnedStatus === 'returned';
      if (restoredCredit) {
        branch.usedCredit = (branch.usedCredit || 0) + (sale.totalCost || 0);
        creditReverted = sale.totalCost || 0;
        await branch.save();
      }
    }

    // Update sale status
    sale.status = 'voided';
    sale.costReturnedStatus = 'not_applicable';
    await sale.save();

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'VOID_SALE',
      entity: 'Sale',
      entityId: sale._id.toString(),
      details: {
        receiptNumber: sale.receiptNumber,
        itemsCount: sale.items.length,
        grandTotal: sale.grandTotal,
        creditReverted,
        newUsedCredit: branch ? branch.usedCredit : 0
      }
    });

    res.json({
      success: true,
      message: `ยกเลิกบิลขายเลขที่ ${sale.receiptNumber} คืนสินค้าเข้าคลังสต็อกเรียบร้อยแล้ว`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  returnCostToHq,
  createSale,
  getSaleReceipt,
  getSalesHistory,
  getFinanceProfitReport,
  updateFinancePayoutStatus,
  getExecutiveDashboard,
  getExecutiveReportRange,
  voidSale
};

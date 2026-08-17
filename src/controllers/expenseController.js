const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

const createExpense = async (req, res, next) => {
  try {
    const { branchId, title, category, amount, note, expenseDate } = req.body;

    if (!title || !category || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อรายการ หมวดหมู่ และจำนวนเงิน' });
    }

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || req.user.role === 'purchase_staff' || isHqUser;

    let targetBranchId = null;
    if (!isAdminOrHq) {
      targetBranchId = req.user.branch ? (req.user.branch._id || req.user.branch) : null;
    } else if (branchId && branchId !== 'hq') {
      targetBranchId = branchId;
    }

    let branchCode = 'HQ';
    if (targetBranchId) {
      const branch = await Branch.findById(targetBranchId);
      if (branch) {
        branchCode = branch.code || 'BR';
      }
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const expenseNumber = `EXP-${branchCode}-${dateStr}-${randomNum}`;

    const expense = await Expense.create({
      expenseNumber,
      title: title.trim(),
      branch: targetBranchId,
      category: category.trim(),
      amount: Number(amount),
      note,
      recordedBy: req.user._id,
      expenseDate: expenseDate ? new Date(expenseDate) : today
    });

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_EXPENSE',
      entity: 'Expense',
      entityId: expense._id.toString(),
      details: { expenseNumber, title: expense.title, amount: Number(amount), category: expense.category }
    });

    res.status(201).json({
      success: true,
      message: 'บันทึกรายจ่ายสำเร็จ',
      expense
    });
  } catch (err) {
    next(err);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const { branchId, category, startDate, endDate, search } = req.query;
    let query = {};

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || req.user.role === 'purchase_staff' || isHqUser;

    if (!isAdminOrHq) {
      const userBranchId = req.user.branch ? (req.user.branch._id || req.user.branch) : null;
      if (userBranchId) query.branch = userBranchId;
    } else if (branchId) {
      query.branch = branchId === 'hq' ? null : branchId;
    }

    if (category) {
      query.category = category;
    }

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) query.expenseDate.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    if (search) {
      query.$or = [
        { expenseNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await Expense.find(query)
      .populate('branch', 'name code')
      .populate('recordedBy', 'fullName username')
      .sort({ expenseDate: -1 });

    res.json({
      success: true,
      expenses
    });
  } catch (err) {
    next(err);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรายจ่าย' });
    }

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || req.user.role === 'purchase_staff' || isHqUser;

    if (!isAdminOrHq) {
      const userBranchId = req.user.branch ? (req.user.branch._id || req.user.branch) : null;
      if (String(expense.branch) !== String(userBranchId)) {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ลบรายการรายจ่ายของสาขาอื่น' });
      }
    }

    await expense.deleteOne();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'DELETE_EXPENSE',
      entity: 'Expense',
      entityId: id,
      details: { expenseNumber: expense.expenseNumber, amount: expense.amount }
    });

    res.json({
      success: true,
      message: 'ลบรายการรายจ่ายสำเร็จ'
    });
  } catch (err) {
    next(err);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { branchId, title, category, amount, note, expenseDate } = req.body;

    if (!title || !category || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อรายการ หมวดหมู่ และจำนวนเงิน' });
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรายจ่าย' });
    }

    const isHqUser = req.user.branch ? (req.user.branch.code === 'BR-HQ01' || (req.user.branch.name && req.user.branch.name.includes('สำนักงานใหญ่'))) : true;
    const isAdminOrHq = req.user.role === 'admin' || req.user.role === 'hq_stock_staff' || req.user.role === 'purchase_staff' || isHqUser;

    if (!isAdminOrHq) {
      const userBranchId = req.user.branch ? (req.user.branch._id || req.user.branch) : null;
      if (String(expense.branch) !== String(userBranchId)) {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์แก้ไขรายการรายจ่ายของสาขาอื่น' });
      }
    } else if (branchId !== undefined) {
      expense.branch = (branchId && branchId !== 'hq') ? branchId : null;
    }

    const oldDetails = { title: expense.title, amount: expense.amount, category: expense.category, note: expense.note };

    expense.title = title.trim();
    expense.category = category.trim();
    expense.amount = Number(amount);
    expense.note = note;
    if (expenseDate) {
      expense.expenseDate = new Date(expenseDate);
    }

    await expense.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'UPDATE_EXPENSE',
      entity: 'Expense',
      entityId: expense._id.toString(),
      details: { expenseNumber: expense.expenseNumber, before: oldDetails, after: { title: expense.title, amount: expense.amount, category: expense.category, note: expense.note } }
    });

    res.json({
      success: true,
      message: 'แก้ไขรายการรายจ่ายสำเร็จ',
      expense
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  deleteExpense,
  updateExpense
};

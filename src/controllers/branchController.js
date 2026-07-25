const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

const getAllBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find().sort({ code: 1 });
    res.json({
      success: true,
      branches
    });
  } catch (err) {
    next(err);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const { branchCode, code, branchName, name, address, phone, contactInfo, creditLimit } = req.body;

    const finalCode = (branchCode || code || '').trim().toUpperCase();
    const finalName = (branchName || name || '').trim();
    const finalAddress = address || contactInfo || '';

    if (!finalCode || !finalName) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสสาขาและชื่อสาขาให้ครบถ้วน' });
    }

    const existing = await Branch.findOne({ code: finalCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `รหัสสาขานี้ (${finalCode}) มีอยู่ในระบบแล้ว` });
    }

    const branch = await Branch.create({
      code: finalCode,
      name: finalName,
      address: finalAddress,
      phone: phone || '',
      creditLimit: Number(creditLimit) || 0,
      isActive: true
    });

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'CREATE_BRANCH',
        entity: 'Branch',
        entityId: branch._id.toString(),
        details: { code: branch.code, name: branch.name, creditLimit: branch.creditLimit }
      });
    }

    res.status(201).json({
      success: true,
      message: 'เพิ่มสาขาใหม่สำเร็จ',
      branch
    });
  } catch (err) {
    next(err);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { branchName, name, address, phone, contactInfo, creditLimit, isActive } = req.body;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสาขาที่ระบุ' });
    }

    if (branchName || name) branch.name = (branchName || name).trim();
    if (address !== undefined) branch.address = address;
    if (phone !== undefined) branch.phone = phone;
    if (contactInfo !== undefined && !address) branch.address = contactInfo;
    if (creditLimit !== undefined) branch.creditLimit = Number(creditLimit) || 0;
    if (isActive !== undefined) branch.isActive = Boolean(isActive);

    await branch.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'UPDATE_BRANCH',
        entity: 'Branch',
        entityId: branch._id.toString(),
        details: { code: branch.code, name: branch.name, isActive: branch.isActive }
      });
    }

    res.json({
      success: true,
      message: 'อัปเดตข้อมูลสาขาสำเร็จ',
      branch
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBranches,
  createBranch,
  updateBranch
};

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().populate('branch').sort({ createdAt: -1 });
    res.json({
      success: true,
      users
    });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { empId, fullName, username, email, password, role, branchId, branch } = req.body;

    const targetBranchId = branchId || branch;

    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลพนักงานให้ครบถ้วน' });
    }

    // Check unique username / email / empId
    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() },
        ...(empId ? [{ empId: empId.trim() }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้งาน (Username), อีเมล หรือ รหัสพนักงาน มีอยู่ในระบบแล้ว' });
    }

    if (targetBranchId) {
      const b = await Branch.findById(targetBranchId);
      if (!b) {
        return res.status(400).json({ success: false, message: 'สาขาประจำที่ระบุไม่ถูกต้อง' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userCount = await User.countDocuments();
    const generatedEmpId = empId ? empId.trim() : `EMP-${String(userCount + 1).padStart(4, '0')}`;

    const newUser = await User.create({
      empId: generatedEmpId,
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      branch: targetBranchId || null,
      isActive: true
    });

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: newUser._id.toString(),
        details: { empId: newUser.empId, fullName: newUser.fullName, role: newUser.role }
      });
    }

    const populatedUser = await User.findById(newUser._id).populate('branch');

    res.status(201).json({
      success: true,
      message: 'เพิ่มพนักงานใหม่สำเร็จ',
      user: populatedUser
    });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, role, branchId, branch, isActive, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงานที่ระบุ' });
    }

    if (fullName) user.fullName = fullName.trim();
    if (role) user.role = role;
    
    const targetBranch = branchId !== undefined ? branchId : branch;
    if (targetBranch !== undefined) user.branch = targetBranch || null;
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    if (password && password.trim()) {
      user.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await user.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: user._id.toString(),
        details: { empId: user.empId, fullName: user.fullName, role: user.role }
      });
    }

    const updatedUser = await User.findById(user._id).populate('branch');

    res.json({
      success: true,
      message: 'อัปเดตข้อมูลพนักงานสำเร็จ',
      user: updatedUser
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser
};

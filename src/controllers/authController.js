const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const { SYSTEM_MENUS } = require('./roleController');

const getRoleDetails = async (userRoleCode) => {
  const allMenuKeys = SYSTEM_MENUS.map(m => m.key);
  const roleDoc = await Role.findOne({ code: userRoleCode });
  
  const defaultRoles = {
    'admin': 'ผู้ดูแลระบบสูงสุด (Admin)',
    'hq_stock_staff': 'พนักงานคลังสินค้าส่วนกลาง (HQ Stock)',
    'branch_staff': 'พนักงานประจำสาขา (Branch Staff)',
    'purchase_staff': 'พนักงานฝ่ายจัดซื้อ (Purchasing Staff)',
    'technical_staff': 'ช่างเทคนิค (Technical Staff)'
  };

  if (roleDoc) {
    return {
      allowedMenus: Array.isArray(roleDoc.allowedMenus) ? roleDoc.allowedMenus : allMenuKeys,
      roleName: roleDoc.name || defaultRoles[userRoleCode] || userRoleCode
    };
  }

  return {
    allowedMenus: allMenuKeys,
    roleName: defaultRoles[userRoleCode] || userRoleCode
  };
};

const login = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = (username || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้งาน (Username) และรหัสผ่านให้ครบถ้วน' });
    }

    // Allow lookup by either Username or Email for maximum user flexibility
    const user = await User.findOne({
      $or: [
        { username: { $regex: `^${loginIdentifier}$`, $options: 'i' } },
        { email: loginIdentifier.toLowerCase() }
      ]
    }).populate('branch');

    if (!user) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'บัญชีผู้ใช้งานถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('🔴 เกิดข้อผิดพลาด: ไม่พบ JWT_SECRET ในไฟล์คอนฟิก .env');
      return res.status(500).json({ success: false, message: 'การตั้งค่าระบบความปลอดภัยไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Audit log
    await AuditLog.create({
      user: user._id,
      username: user.username,
      userRole: user.role,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
      details: { username: user.username, email: user.email }
    });

    const roleDetails = await getRoleDetails(user.role);

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName || user.username,
        email: user.email,
        role: user.role,
        roleName: roleDetails.roleName,
        allowedMenus: roleDetails.allowedMenus,
        branch: user.branch
      }
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const roleDetails = await getRoleDetails(req.user.role);

    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        fullName: req.user.fullName || req.user.username,
        email: req.user.email,
        role: req.user.role,
        roleName: roleDetails.roleName,
        allowedMenus: roleDetails.allowedMenus,
        branch: req.user.branch
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe
};

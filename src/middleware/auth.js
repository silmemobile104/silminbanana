const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'ไม่พบ Token สำหรับการยืนยันตัวตน' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('🔴 เกิดข้อผิดพลาด: ไม่พบ JWT_SECRET ในไฟล์คอนฟิก .env');
    return res.status(500).json({ success: false, message: 'การตั้งค่าระบบความปลอดภัยไม่ถูกต้อง' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }

  try {
    const user = await User.findById(decoded.id).populate('branch');

    if (!user || !user.isActive) {
      return res.status(403).json({ success: false, message: 'บัญชีผู้ใช้งานถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'ไม่พบ Token สำหรับการยืนยันตัวตน' });
    }

    // Allow all active authenticated users. Menu visibility and access is controlled dynamically via Role & Permission Management.
    next();
  };
};

module.exports = {
  authenticateToken,
  authorize
};

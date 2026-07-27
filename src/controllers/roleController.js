const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');

const SYSTEM_MENUS = [
  { key: 'dashboard', name: 'แดชบอร์ด', icon: 'fa-chart-pie' },
  { key: 'pos', name: 'ขายสินค้า (POS)', icon: 'fa-cash-register' },
  { key: 'finance', name: 'รายงานการเงิน', icon: 'fa-coins' },
  { key: 'branch-inventory', name: 'สินค้าในสาขา', icon: 'fa-boxes-packing' },
  { key: 'hq-audit', name: 'ตรวจสอบสต็อกส่วนกลาง', icon: 'fa-clipboard-check' },
  { key: 'branch-audit', name: 'นับสต็อกประจำวัน', icon: 'fa-barcode' },
  { key: 'goods-receipt', name: 'รับสินค้าเข้าสต็อก', icon: 'fa-truck-ramp-box' },
  { key: 'purchase-orders', name: 'สั่งซื้อสินค้าลงสาขา', icon: 'fa-cart-flatbed' },
  { key: 'receipt-verification', name: 'ตรวจสอบรายการรับสินค้าเข้าสต็อก', icon: 'fa-clipboard-check' },
  { key: 'transfers', name: 'โอนย้ายสินค้าระหว่างสาขา', icon: 'fa-arrow-right-arrow-left' },
  { key: 'master-settings', name: 'ตั้งค่าตัวเลือกสินค้า', icon: 'fa-sliders' },
  { key: 'branches', name: 'จัดการสาขา', icon: 'fa-store' },
  { key: 'employees', name: 'จัดการพนักงาน', icon: 'fa-users-gear' },
  { key: 'roles-permissions', name: 'จัดการสิทธิ์และตำแหน่ง', icon: 'fa-user-shield' }
];

// Helper to seed default system roles if database is empty
const seedDefaultRolesIfEmpty = async () => {
  const allMenuKeys = SYSTEM_MENUS.map(m => m.key);
  
  let adminRole = await Role.findOne({ code: 'admin' });
  if (!adminRole) {
    await Role.create({
      name: 'ผู้ดูแลระบบสูงสุด (Admin)',
      code: 'admin',
      description: 'มีสิทธิ์การใช้งานเต็มทุกเมนูในระบบ',
      allowedMenus: allMenuKeys,
      isSystemDefault: true
    });
  }
};

const getRoles = async (req, res, next) => {
  try {
    await seedDefaultRolesIfEmpty();
    const roles = await Role.find().sort({ isSystemDefault: -1, createdAt: 1 });
    
    res.json({
      success: true,
      roles,
      systemMenus: SYSTEM_MENUS
    });
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { name, code, description, allowedMenus } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อตำแหน่งงาน' });
    }

    const cleanName = name.trim();
    const generatedCode = code ? code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : `role_${Date.now()}`;

    const existing = await Role.findOne({
      $or: [
        { name: cleanName },
        { code: generatedCode }
      ]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: `ตำแหน่ง "${cleanName}" หรือรหัสตำแหน่งนี้มีอยู่ในระบบแล้ว` });
    }

    const newRole = await Role.create({
      name: cleanName,
      code: generatedCode,
      description: description || '',
      allowedMenus: Array.isArray(allowedMenus) ? allowedMenus : [],
      isSystemDefault: false
    });

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'CREATE_ROLE',
        entity: 'Role',
        entityId: newRole._id.toString(),
        details: { name: newRole.name, code: newRole.code, menusCount: newRole.allowedMenus.length }
      });
    }

    res.status(201).json({
      success: true,
      message: `สร้างตำแหน่ง "${newRole.name}" สำเร็จ`,
      role: newRole
    });
  } catch (err) {
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, allowedMenus } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลตำแหน่งที่ระบุ' });
    }

    if (name) role.name = name.trim();
    if (description !== undefined) role.description = description;
    if (Array.isArray(allowedMenus)) {
      role.allowedMenus = allowedMenus;
    }

    await role.save();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'UPDATE_ROLE',
        entity: 'Role',
        entityId: role._id.toString(),
        details: { name: role.name, code: role.code, allowedMenusCount: role.allowedMenus.length }
      });
    }

    res.json({
      success: true,
      message: `อัปเดตสิทธิ์ตำแหน่ง "${role.name}" สำเร็จ`,
      role
    });
  } catch (err) {
    next(err);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลตำแหน่งที่ระบุ' });
    }

    if (role.isSystemDefault || role.code === 'admin') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบตำแหน่งหลักของระบบได้' });
    }

    await Role.findByIdAndDelete(id);

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'DELETE_ROLE',
        entity: 'Role',
        entityId: id,
        details: { name: role.name, code: role.code }
      });
    }

    res.json({
      success: true,
      message: `ลบตำแหน่ง "${role.name}" เรียบร้อยแล้ว`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  SYSTEM_MENUS,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  seedDefaultRolesIfEmpty
};

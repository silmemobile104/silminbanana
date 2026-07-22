const MasterOption = require('../models/MasterOption');
const AuditLog = require('../models/AuditLog');

// Get all active master options grouped by type
const getMasterOptions = async (req, res, next) => {
  try {
    const options = await MasterOption.find({ isActive: { $ne: false } }).sort({ value: 1 });
    
    const grouped = {
      brands: options.filter(o => o.type === 'brand'),
      models: options.filter(o => o.type === 'model'),
      capacities: options.filter(o => o.type === 'capacity'),
      colors: options.filter(o => o.type === 'color'),
      variations: options.filter(o => o.type === 'variation'),
      categories: options.filter(o => o.type === 'category')
    };

    res.json({
      success: true,
      options: grouped,
      rawList: options
    });
  } catch (err) {
    next(err);
  }
};

// Create a new master option
const createMasterOption = async (req, res, next) => {
  try {
    const { type, value, parent } = req.body;

    if (!type || !value || !value.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทและข้อความตัวเลือก Master' });
    }

    const cleanValue = value.trim();

    // Case-insensitive lookup for existing option
    const existing = await MasterOption.findOne({
      type,
      value: { $regex: `^${cleanValue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, $options: 'i' }
    });

    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        existing.parent = parent || existing.parent;
        await existing.save();
        return res.json({ success: true, message: `เปิดใช้งานตัวเลือก Master "${cleanValue}" อีกครั้งสำเร็จ`, option: existing });
      }
      return res.status(400).json({ success: false, message: `มีตัวเลือก Master "${cleanValue}" ในระบบอยู่แล้ว` });
    }

    const newOption = await MasterOption.create({
      type,
      value: cleanValue,
      parent: parent || null,
      isActive: true
    });

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_MASTER_OPTION',
      entity: 'MasterOption',
      entityId: newOption._id.toString(),
      details: { type, value: cleanValue, parent }
    });

    res.status(201).json({
      success: true,
      message: `เพิ่มตัวเลือก Master "${cleanValue}" สำเร็จ`,
      option: newOption
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing master option
const updateMasterOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { value, parent, isActive } = req.body;

    const option = await MasterOption.findById(id);
    if (!option) {
      return res.status(404).json({ success: false, message: 'ไม่พบตัวเลือก Master ที่ต้องการแก้ไข' });
    }

    if (value) option.value = value.trim();
    if (parent !== undefined) option.parent = parent;
    if (isActive !== undefined) option.isActive = Boolean(isActive);

    await option.save();

    res.json({
      success: true,
      message: 'อัปเดตตัวเลือก Master สำเร็จ',
      option
    });
  } catch (err) {
    next(err);
  }
};

// Delete (Hard Delete completely from Database)
const deleteMasterOption = async (req, res, next) => {
  try {
    const { id } = req.params;

    const option = await MasterOption.findByIdAndDelete(id);
    if (!option) {
      return res.status(404).json({ success: false, message: 'ไม่พบตัวเลือก Master ที่ต้องการลบ' });
    }

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'DELETE_MASTER_OPTION',
      entity: 'MasterOption',
      entityId: id,
      details: { type: option.type, value: option.value }
    });

    res.json({
      success: true,
      message: `ลบตัวเลือก Master "${option.value}" ออกจากฐานข้อมูลถาวรเรียบร้อยแล้ว`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMasterOptions,
  createMasterOption,
  updateMasterOption,
  deleteMasterOption
};

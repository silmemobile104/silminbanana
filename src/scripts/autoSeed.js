const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Branch = require('../models/Branch');
const User = require('../models/User');
const MasterOption = require('../models/MasterOption');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const DailyAudit = require('../models/DailyAudit');

const autoSeedIfEmpty = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return; // Database already populated
    }

    console.log('[AutoSeed] Database is empty. Auto-seeding 5 Thai branches, master options, and user accounts...');

    // 1. Create 5 Pre-configured Branches
    const branchData = [
      { code: 'BR-HQ01', name: 'สาขาใหญ่ สีลม (สำนักงานใหญ่)', address: '101 อาคารสีลมทาวเวอร์ ถนนสีลม กรุงเทพฯ', phone: '02-111-2222' },
      { code: 'BR-N002', name: 'สาขาภาคเหนือ (เชียงใหม่ นิมมาน)', address: '88 ถนนนิมมานเหอมินทร์ อ.เมือง จ.เชียงใหม่', phone: '053-999-888' },
      { code: 'BR-S003', name: 'สาขาภาคใต้ (ภูเก็ต ป่าตอง)', address: '45 ถนนหาดป่าตอง อ.กะทู้ จ.ภูเก็ต', phone: '076-444-555' },
      { code: 'BR-E004', name: 'สาขาภาคตะวันออก (ชลบุรี บางแสน)', address: '12 ถนนลงหาดบางแสน อ.เมือง จ.ชลบุรี', phone: '038-777-666' },
      { code: 'BR-W005', name: 'สาขาภาคตะวันตก (นนทบุรี รัตนาธิเบศร์)', address: '99 ถนนรัตนาธิเบศร์ อ.เมือง จ.นนทบุรี', phone: '02-333-4444' }
    ];

    const branches = await Branch.insertMany(branchData);
    const branchMap = {};
    branches.forEach(b => branchMap[b.code] = b._id);

    // 2. Predefined Master Options (Capacity & Color separated)
    const masterOptionsData = [
      { type: 'brand', value: 'Apple' },
      { type: 'brand', value: 'Samsung' },
      { type: 'brand', value: 'Xiaomi' },
      { type: 'brand', value: 'Sony' },
      { type: 'brand', value: 'Asus' },

      { type: 'model', value: 'iPhone 15 Pro', parent: 'Apple' },
      { type: 'model', value: 'iPhone 15 Pro Max', parent: 'Apple' },
      { type: 'model', value: 'Galaxy S24 Ultra', parent: 'Samsung' },
      { type: 'model', value: 'Galaxy S24+', parent: 'Samsung' },
      { type: 'model', value: 'Redmi Note 13 Pro', parent: 'Xiaomi' },

      { type: 'capacity', value: '128GB' },
      { type: 'capacity', value: '256GB' },
      { type: 'capacity', value: '512GB' },
      { type: 'capacity', value: '1TB' },

      { type: 'color', value: 'ไทเทเนียมธรรมชาติ (Natural Titanium)' },
      { type: 'color', value: 'ไทเทเนียมดำ (Black Titanium)' },
      { type: 'color', value: 'ไทเทเนียมเทา (Titanium Gray)' },
      { type: 'color', value: 'ดำมิดไนท์ (Midnight Black)' },
      { type: 'color', value: 'ขาวสตาร์ไลท์ (Starlight White)' },

      { type: 'category', value: 'สมาร์ทโฟน (Smartphone)' },
      { type: 'category', value: 'แท็บเล็ต (Tablet)' },
      { type: 'category', value: 'อุปกรณ์สวมใส่ (Wearable)' },
      { type: 'category', value: 'อุปกรณ์เสริม (Accessory)' }
    ];

    await MasterOption.insertMany(masterOptionsData);

    // 3. Create Default User Accounts with Username Login
    const defaultPasswordHash = await bcrypt.hash('Staff@123456', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);

    const userData = [
      { empId: 'EMP-0001', username: 'admin', fullName: 'สมชาย ผู้ดูแลระบบ (Admin)', email: 'admin@pos.com', passwordHash: adminPasswordHash, role: 'admin', branch: branchMap['BR-HQ01'] },
      { empId: 'EMP-0002', username: 'auditor', fullName: 'วิภา ฝ่ายสต็อกส่วนกลาง (HQ Auditor)', email: 'auditor@pos.com', passwordHash: defaultPasswordHash, role: 'hq_stock_staff', branch: branchMap['BR-HQ01'] },
      { empId: 'EMP-0003', username: 'staff.b1', fullName: 'พนักงาน สาขา 1 (สีลม)', email: 'staff.b1@pos.com', passwordHash: defaultPasswordHash, role: 'branch_staff', branch: branchMap['BR-HQ01'] },
      { empId: 'EMP-0004', username: 'staff.b2', fullName: 'พนักงาน สาขา 2 (เชียงใหม่)', email: 'staff.b2@pos.com', passwordHash: defaultPasswordHash, role: 'branch_staff', branch: branchMap['BR-N002'] },
      { empId: 'EMP-0005', username: 'tech', fullName: 'ช่างเทคนิค ประจำสาขา (Tech Staff)', email: 'tech@pos.com', passwordHash: defaultPasswordHash, role: 'technical_staff', branch: branchMap['BR-HQ01'] },
      { empId: 'EMP-0006', username: 'purchase', fullName: 'อนันต์ เจ้าหน้าที่ฝ่ายจัดซื้อ', email: 'purchase@pos.com', passwordHash: defaultPasswordHash, role: 'purchase_staff', branch: branchMap['BR-HQ01'] }
    ];

    const users = await User.insertMany(userData);

    // 4. Create Master Products
    const productsData = [
      {
        name: 'Apple iPhone 15 Pro 256GB ไทเทเนียมธรรมชาติ',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        capacity: '256GB',
        color: 'ไทเทเนียมธรรมชาติ (Natural Titanium)',
        variation: '256GB - ไทเทเนียมธรรมชาติ (Natural Titanium)',
        category: 'สมาร์ทโฟน (Smartphone)',
        purchase_price: 38000,
        selling_price: 41900,
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop&q=60'],
        hasImei: true
      },
      {
        name: 'Samsung Galaxy S24 Ultra 256GB ไทเทเนียมเทา',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        capacity: '256GB',
        color: 'ไทเทเนียมเทา (Titanium Gray)',
        variation: '256GB - ไทเทเนียมเทา (Titanium Gray)',
        category: 'สมาร์ทโฟน (Smartphone)',
        purchase_price: 40000,
        selling_price: 44900,
        images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&auto=format&fit=crop&q=60'],
        hasImei: true
      }
    ];

    const products = await Product.insertMany(productsData);
    const iphoneProd = products.find(p => p.brand === 'Apple');
    const samsungProd = products.find(p => p.brand === 'Samsung');

    // 5. Initial Stock with 1 document per physical device IMEI
    const now = new Date();
    const stockEntries = [
      {
        branch: branchMap['BR-HQ01'],
        product: iphoneProd._id,
        imei: '358912345678901',
        productName: iphoneProd.name,
        brand: iphoneProd.brand,
        model: iphoneProd.model,
        capacity: iphoneProd.capacity,
        color: iphoneProd.color,
        category: iphoneProd.category,
        purchase_price: iphoneProd.purchase_price,
        selling_price: iphoneProd.selling_price,
        status: 'in_stock',
        import_date: now
      },
      {
        branch: branchMap['BR-HQ01'],
        product: iphoneProd._id,
        imei: '358912345678902',
        productName: iphoneProd.name,
        brand: iphoneProd.brand,
        model: iphoneProd.model,
        capacity: iphoneProd.capacity,
        color: iphoneProd.color,
        category: iphoneProd.category,
        purchase_price: iphoneProd.purchase_price,
        selling_price: iphoneProd.selling_price,
        status: 'in_stock',
        import_date: now
      },
      {
        branch: branchMap['BR-HQ01'],
        product: iphoneProd._id,
        imei: '358912345678903',
        productName: iphoneProd.name,
        brand: iphoneProd.brand,
        model: iphoneProd.model,
        capacity: iphoneProd.capacity,
        color: iphoneProd.color,
        category: iphoneProd.category,
        purchase_price: iphoneProd.purchase_price,
        selling_price: iphoneProd.selling_price,
        status: 'in_stock',
        import_date: now
      },
      {
        branch: branchMap['BR-N002'],
        product: iphoneProd._id,
        imei: '358912345678904',
        productName: iphoneProd.name,
        brand: iphoneProd.brand,
        model: iphoneProd.model,
        capacity: iphoneProd.capacity,
        color: iphoneProd.color,
        category: iphoneProd.category,
        purchase_price: iphoneProd.purchase_price,
        selling_price: iphoneProd.selling_price,
        status: 'in_stock',
        import_date: now
      },
      {
        branch: branchMap['BR-N002'],
        product: iphoneProd._id,
        imei: '358912345678905',
        productName: iphoneProd.name,
        brand: iphoneProd.brand,
        model: iphoneProd.model,
        capacity: iphoneProd.capacity,
        color: iphoneProd.color,
        category: iphoneProd.category,
        purchase_price: iphoneProd.purchase_price,
        selling_price: iphoneProd.selling_price,
        status: 'in_stock',
        import_date: now
      }
    ];

    await Stock.insertMany(stockEntries);

    // 6. Demo Daily Audit
    const todayStr = new Date().toISOString().split('T')[0];
    const b1User = users.find(u => u.username === 'staff.b1');

    await DailyAudit.create({
      auditDate: todayStr,
      branch: branchMap['BR-HQ01'],
      submittedBy: b1User._id,
      status: 'Pending Verification',
      items: [
        {
          product: iphoneProd._id,
          productName: iphoneProd.name,
          expectedCount: 3,
          actualCount: 3,
          variance: 0,
          expectedImeis: ['358912345678901', '358912345678902', '358912345678903'],
          scannedImeis: ['358912345678901', '358912345678902', '358912345678903'],
          missingImeis: [],
          unexpectedImeis: []
        }
      ],
      totalExpected: 3,
      totalActual: 3,
      totalVariance: 0,
      auditLog: [{
        action: 'SUBMIT_DAILY_CHECK',
        performedBy: b1User._id,
        timestamp: new Date(),
        notes: 'ส่งรายงานนับสต็อกประจำวันเริ่มต้น'
      }]
    });

    console.log('[AutoSeed] Auto-seeding completed with IMEI-based stock documents!');
  } catch (err) {
    console.error('[AutoSeed Error]', err.message);
  }
};

module.exports = autoSeedIfEmpty;

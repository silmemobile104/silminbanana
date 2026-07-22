const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Branch = require('../models/Branch');
const User = require('../models/User');
const MasterOption = require('../models/MasterOption');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const DailyAudit = require('../models/DailyAudit');
const AuditLog = require('../models/AuditLog');

const seedData = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/silmin_banana_stock';
  
  try {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('[Seed] Connected to external MongoDB.');
    } catch (err) {
      console.log('[Seed] External MongoDB not found. Starting MongoMemoryServer for seed...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const memUri = mongoServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[Seed] Connected to MongoMemoryServer at: ${memUri}`);
    }

    // Clear existing data
    await Promise.all([
      Branch.deleteMany({}),
      User.deleteMany({}),
      MasterOption.deleteMany({}),
      Product.deleteMany({}),
      Stock.deleteMany({}),
      DailyAudit.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('[Seed] Database wiped clean.');

    // 1. Create 5 Pre-configured Branches with Thai Names & Codes
    const branchData = [
      { code: 'BR-HQ01', name: 'สาขาใหญ่ สีลม (สำนักงานใหญ่)', address: '101 อาคารสีลมทาวเวอร์ ถนนสีลม กรุงเทพฯ', phone: '02-111-2222' },
      { code: 'BR-N002', name: 'สาขาภาคเหนือ (เชียงใหม่ นิมมาน)', address: '88 ถนนนิมมานเหอมินทร์ อ.เมือง จ.เชียงใหม่', phone: '053-999-888' },
      { code: 'BR-S003', name: 'สาขาภาคใต้ (ภูเก็ต ป่าตอง)', address: '45 ถนนหาดป่าตอง อ.กะทู้ จ.ภูเก็ต', phone: '076-444-555' },
      { code: 'BR-E004', name: 'สาขาภาคตะวันออก (ชลบุรี บางแสน)', address: '12 ถนนลงหาดบางแสน อ.เมือง จ.ชลบุรี', phone: '038-777-666' },
      { code: 'BR-W005', name: 'สาขาภาคตะวันตก (นนทบุรี รัตนาธิเบศร์)', address: '99 ถนนรัตนาธิเบศร์ อ.เมือง จ.นนทบุรี', phone: '02-333-4444' }
    ];

    const branches = await Branch.insertMany(branchData);
    console.log(`[Seed] Created ${branches.length} Thai branches.`);

    const branchMap = {};
    branches.forEach(b => branchMap[b.code] = b._id);

    // 2. Predefined Master Options
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

      { type: 'variation', value: '128GB ไทเทเนียมธรรมชาติ (Natural Titanium)' },
      { type: 'variation', value: '256GB ไทเทเนียมธรรมชาติ (Natural Titanium)' },
      { type: 'variation', value: '512GB ไทเทเนียมดำ (Black Titanium)' },
      { type: 'variation', value: '256GB ไทเทเนียมเทา (Titanium Gray)' },
      { type: 'variation', value: '256GB ดำมิดไนท์ (Midnight Black)' },

      { type: 'category', value: 'สมาร์ทโฟน (Smartphone)' },
      { type: 'category', value: 'แท็บเล็ต (Tablet)' },
      { type: 'category', value: 'อุปกรณ์สวมใส่ (Wearable)' },
      { type: 'category', value: 'อุปกรณ์เสริม (Accessory)' }
    ];

    await MasterOption.insertMany(masterOptionsData);
    console.log(`[Seed] Created ${masterOptionsData.length} master options.`);

    // 3. Create Users
    const defaultPasswordHash = await bcrypt.hash('Staff@123456', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);

    const userData = [
      { username: 'สมชาย ผู้ดูแลระบบ (Admin)', email: 'admin@pos.com', passwordHash: adminPasswordHash, role: 'admin', branch: branchMap['BR-HQ01'] },
      { username: 'วิภา ฝ่ายสต็อกส่วนกลาง (HQ Auditor)', email: 'auditor@pos.com', passwordHash: defaultPasswordHash, role: 'hq_stock_staff', branch: branchMap['BR-HQ01'] },
      { username: 'พนักงาน สาขา 1 (สีลม)', email: 'staff.b1@pos.com', passwordHash: defaultPasswordHash, role: 'branch_staff', branch: branchMap['BR-HQ01'] },
      { username: 'พนักงาน สาขา 2 (เชียงใหม่)', email: 'staff.b2@pos.com', passwordHash: defaultPasswordHash, role: 'branch_staff', branch: branchMap['BR-N002'] },
      { username: 'ช่างเทคนิค ประจำสาขา (Tech Staff)', email: 'tech@pos.com', passwordHash: defaultPasswordHash, role: 'technical_staff', branch: branchMap['BR-HQ01'] },
      { username: 'อนันต์ เจ้าหน้าที่ฝ่ายจัดซื้อ', email: 'purchase@pos.com', passwordHash: defaultPasswordHash, role: 'purchase_staff', branch: branchMap['BR-HQ01'] }
    ];

    const users = await User.insertMany(userData);
    console.log(`[Seed] Created ${users.length} users with Thai roles.`);

    // 4. Create Master Products
    const productsData = [
      {
        sku: 'APL-IP15P-256NT',
        name: 'Apple iPhone 15 Pro 256GB ไทเทเนียมธรรมชาติ',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        variation: '256GB ไทเทเนียมธรรมชาติ (Natural Titanium)',
        category: 'สมาร์ทโฟน (Smartphone)',
        purchase_price: 38000,
        selling_price: 41900,
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop&q=60'],
        hasImei: true
      },
      {
        sku: 'SAM-S24U-256TG',
        name: 'Samsung Galaxy S24 Ultra 256GB ไทเทเนียมเทา',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        variation: '256GB ไทเทเนียมเทา (Titanium Gray)',
        category: 'สมาร์ทโฟน (Smartphone)',
        purchase_price: 40000,
        selling_price: 44900,
        images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&auto=format&fit=crop&q=60'],
        hasImei: true
      }
    ];

    const products = await Product.insertMany(productsData);
    console.log(`[Seed] Created ${products.length} master products in Thai.`);

    const prodMap = {};
    products.forEach(p => prodMap[p.sku] = p);

    // 5. Initial Stock
    const now = new Date();
    const stockEntries = [
      {
        branch: branchMap['BR-HQ01'],
        product: prodMap['APL-IP15P-256NT']._id,
        sku: 'APL-IP15P-256NT',
        quantity: 3,
        import_date: now,
        imei_serials: [
          { imei: '358912345678901', status: 'in_stock', received_date: now },
          { imei: '358912345678902', status: 'in_stock', received_date: now },
          { imei: '358912345678903', status: 'in_stock', received_date: now }
        ]
      },
      {
        branch: branchMap['BR-N002'],
        product: prodMap['APL-IP15P-256NT']._id,
        sku: 'APL-IP15P-256NT',
        quantity: 2,
        import_date: now,
        imei_serials: [
          { imei: '358912345678904', status: 'in_stock', received_date: now },
          { imei: '358912345678905', status: 'in_stock', received_date: now }
        ]
      }
    ];

    await Stock.insertMany(stockEntries);
    console.log(`[Seed] Inventory initialized.`);

    // 6. Demo Daily Audit
    const todayStr = new Date().toISOString().split('T')[0];
    const b1User = users.find(u => u.username === 'พนักงาน สาขา 1 (สีลม)');

    await DailyAudit.create({
      auditDate: todayStr,
      branch: branchMap['BR-HQ01'],
      submittedBy: b1User._id,
      status: 'Pending Verification',
      items: [
        {
          product: prodMap['APL-IP15P-256NT']._id,
          sku: 'APL-IP15P-256NT',
          productName: prodMap['APL-IP15P-256NT'].name,
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

    console.log('[Seed] Demo Daily Audit created.');
    console.log('\n======================================================');
    console.log('SEEDING THAI LOCALIZATION COMPLETE!');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
};

seedData();

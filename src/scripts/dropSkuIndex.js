/**
 * Script: dropSkuIndex.js
 * Purpose: Drop legacy 'sku_1' index from 'products' collection
 * Run: node src/scripts/dropSkuIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function dropSkuIndex() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('🔴 ไม่พบ MONGO_URI ในไฟล์ .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log('🟢 เชื่อมต่อ MongoDB สำเร็จ');

    const db = mongoose.connection.db;

    // Drop sku_1 index from products collection
    try {
      await db.collection('products').dropIndex('sku_1');
      console.log('✅ ลบ index "sku_1" จาก products collection สำเร็จ');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  ไม่พบ index "sku_1" (อาจถูกลบไปแล้ว หรือไม่เคยมี)');
      } else {
        throw err;
      }
    }

    // Drop sku_1 index from stocks collection (ถ้ามี)
    try {
      await db.collection('stocks').dropIndex('sku_1');
      console.log('✅ ลบ index "sku_1" จาก stocks collection สำเร็จ');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  ไม่พบ index "sku_1" ใน stocks (อาจถูกลบไปแล้ว)');
      } else {
        throw err;
      }
    }

    // Show remaining indexes for verification
    const productIndexes = await db.collection('products').indexes();
    console.log('\n📋 Indexes ที่เหลือใน products collection:');
    productIndexes.forEach(idx => console.log('  -', JSON.stringify(idx.key)));

    const stockIndexes = await db.collection('stocks').indexes();
    console.log('\n📋 Indexes ที่เหลือใน stocks collection:');
    stockIndexes.forEach(idx => console.log('  -', JSON.stringify(idx.key)));

    console.log('\n🎉 เสร็จสิ้น! ลองบันทึกใบสั่งซื้อได้เลย');

  } catch (err) {
    console.error('🔴 เกิดข้อผิดพลาด:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

dropSkuIndex();

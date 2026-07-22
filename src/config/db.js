const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    const errorMsg = 'ไม่พบ MONGO_URI ในไฟล์คอนฟิก .env กรุณาระบุการเชื่อมต่อฐานข้อมูล';
    console.error(`🔴 เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log("🟢 เชื่อมต่อฐานข้อมูล MongoDB Atlas สำเร็จ");
  } catch (error) {
    console.error("🔴 เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล:", error.message || error);
    
    // In local development mode, launch MongoMemoryServer if Atlas connection times out or fails
    if (process.env.NODE_ENV !== 'production') {
      console.log("🟡 กำลังเปิดใช้งานในโหมดสำรอง MongoMemoryServer สำหรับการรันในเครื่อง...");
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoMemoryServer = await MongoMemoryServer.create();
        const memoryUri = mongoMemoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log("🟢 เชื่อมต่อฐานข้อมูลสำรอง (Memory DB) สำเร็จ");
      } catch (memErr) {
        console.error("🔴 ไม่สามารถเปิดใช้งานฐานข้อมูลสำรองได้:", memErr.message);
      }
    }
  }
};

module.exports = connectDB;

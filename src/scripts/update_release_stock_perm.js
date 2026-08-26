require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');

const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/silminbanana';

mongoose.connect(dbUri)
  .then(async () => {
    console.log("Connected to MongoDB Atlas");

    // Update admin
    const adminRole = await Role.findOne({ code: 'admin' });
    if (adminRole) {
      if (!adminRole.allowedMenus.includes('release-stock')) {
        adminRole.allowedMenus.push('release-stock');
        await adminRole.save();
        console.log("Updated admin role with 'release-stock' permission.");
      } else {
        console.log("Admin role already has 'release-stock' permission.");
      }
    }

    // Update hq_stock_staff
    const hqRole = await Role.findOne({ code: 'hq_stock_staff' });
    if (hqRole) {
      if (!hqRole.allowedMenus.includes('release-stock')) {
        hqRole.allowedMenus.push('release-stock');
        await hqRole.save();
        console.log("Updated hq_stock_staff role with 'release-stock' permission.");
      } else {
        console.log("hq_stock_staff role already has 'release-stock' permission.");
      }
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(err => {
    console.error("Connection error:", err);
  });

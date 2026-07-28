require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');

const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/silminbanana';

mongoose.connect(dbUri)
  .then(async () => {
    console.log("Connected to MongoDB Atlas");

    // Add 'system-logs' to admin role's allowedMenus if not present
    const adminRole = await Role.findOne({ code: 'admin' });
    if (adminRole) {
      if (!adminRole.allowedMenus.includes('system-logs')) {
        adminRole.allowedMenus.push('system-logs');
      }
      // Also ensure 'edit-branch-inventory' is there
      if (!adminRole.allowedMenus.includes('edit-branch-inventory')) {
        adminRole.allowedMenus.push('edit-branch-inventory');
      }
      await adminRole.save();
      console.log("Successfully updated admin role with 'system-logs' and 'edit-branch-inventory' permissions!");
    } else {
      console.log("Admin role document not found!");
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(err => {
    console.error("Connection error:", err);
  });

require('dotenv').config();
const mongoose = require('mongoose');
const Sale = require('../models/Sale');

const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/silminbanana';

mongoose.connect(dbUri)
  .then(async () => {
    console.log("Connected to MongoDB Atlas");

    // Update existing sales
    const totalSales = await Sale.countDocuments();
    console.log(`Total sales documents to examine: ${totalSales}`);

    const financeUpdate = await Sale.updateMany(
      { paymentMethod: 'finance', costReturnedStatus: { $exists: false } },
      { $set: { costReturnedStatus: 'not_applicable' } }
    );
    console.log(`Updated ${financeUpdate.modifiedCount} finance sales to costReturnedStatus = 'not_applicable'`);

    const otherUpdate = await Sale.updateMany(
      { paymentMethod: { $ne: 'finance' }, costReturnedStatus: { $exists: false } },
      { $set: { costReturnedStatus: 'returned', costReturnedDate: new Date() } }
    );
    console.log(`Updated ${otherUpdate.modifiedCount} other sales to costReturnedStatus = 'returned'`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(err => {
    console.error("Migration error:", err);
  });

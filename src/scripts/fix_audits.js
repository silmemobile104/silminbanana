const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DailyAudit = require('../models/DailyAudit');
const connectDB = require('../config/db');

async function fixAudits() {
  await connectDB();

  const audits = await DailyAudit.find({});
  console.log(`Found ${audits.length} daily audits to verify and clean...`);

  for (const audit of audits) {
    const itemMap = new Map();

    for (const item of audit.items) {
      if (!item.product) continue;
      const pIdStr = item.product.toString();

      if (!itemMap.has(pIdStr)) {
        itemMap.set(pIdStr, {
          product: item.product,
          productName: item.productName,
          expectedCount: 0,
          actualCount: 0,
          variance: 0,
          expectedImeis: [],
          scannedImeis: [],
          missingImeis: [],
          unexpectedImeis: [],
          imeiImages: [],
          imeiDecisions: []
        });
      }

      const grp = itemMap.get(pIdStr);

      // Union expectedImeis
      (item.expectedImeis || []).forEach(imei => {
        if (!grp.expectedImeis.includes(imei)) {
          grp.expectedImeis.push(imei);
        }
      });

      // Union scannedImeis
      (item.scannedImeis || []).forEach(imei => {
        if (!grp.scannedImeis.includes(imei)) {
          grp.scannedImeis.push(imei);
        }
      });

      // Union missingImeis
      (item.missingImeis || []).forEach(imei => {
        if (!grp.missingImeis.includes(imei)) {
          grp.missingImeis.push(imei);
        }
      });

      // Union unexpectedImeis
      (item.unexpectedImeis || []).forEach(imei => {
        if (!grp.unexpectedImeis.includes(imei)) {
          grp.unexpectedImeis.push(imei);
        }
      });

      // Union imeiImages
      (item.imeiImages || []).forEach(img => {
        if (!grp.imeiImages.some(x => x.imei === img.imei)) {
          grp.imeiImages.push(img);
        }
      });

      // Union imeiDecisions
      (item.imeiDecisions || []).forEach(d => {
        if (!grp.imeiDecisions.some(x => x.imei === d.imei)) {
          grp.imeiDecisions.push(d);
        }
      });
    }

    // Recalculate counts for each group
    const cleanedItems = [];
    let totalExpected = 0;
    let totalActual = 0;
    let totalVariance = 0;

    for (const [pIdStr, grp] of itemMap.entries()) {
      grp.expectedCount = grp.expectedImeis.length;
      grp.actualCount = grp.scannedImeis.length;
      grp.variance = grp.actualCount - grp.expectedCount;

      totalExpected += grp.expectedCount;
      totalActual += grp.actualCount;
      totalVariance += Math.abs(grp.variance);

      cleanedItems.push(grp);
    }

    audit.items = cleanedItems;
    audit.totalExpected = totalExpected;
    audit.totalActual = totalActual;
    audit.totalVariance = totalVariance;

    await audit.save();
    console.log(`Updated audit ID ${audit._id} for branch ${audit.branch} on date ${audit.auditDate}: totalExpected=${totalExpected}, totalActual=${totalActual}, totalVariance=${totalVariance}`);
  }

  console.log("Migration complete!");
  mongoose.connection.close();
}

fixAudits().catch(err => {
  console.error("Error in migration:", err);
  mongoose.connection.close();
});

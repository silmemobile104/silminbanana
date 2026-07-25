const migrateStockToOneToOne = require('./migrateStockToOneToOne');

async function repairData() {
  try {
    // 1. Run 1-to-1 Stock Migration
    await migrateStockToOneToOne();
  } catch (err) {
    console.warn('⚡ Data Repair Warning:', err.message);
  }
}

module.exports = repairData;

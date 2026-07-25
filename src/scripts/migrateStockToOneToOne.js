const Stock = require('../models/Stock');
const Product = require('../models/Product');

async function migrateStockToOneToOne() {
  try {
    // Drop old indexes on stocks if any
    try {
      await Stock.collection.dropIndex('branch_1_sku_1');
    } catch (e) {
      // Ignore if index doesn't exist
    }

    const rawDocs = await Stock.collection.find({}).toArray();

    for (const raw of rawDocs) {
      // Check if raw document is an old array-based stock document
      if (Array.isArray(raw.imei_serials) && raw.imei_serials.length > 0) {
        const prod = await Product.findById(raw.product);

        for (const item of raw.imei_serials) {
          const cleanImei = item.imei ? String(item.imei).trim() : null;
          if (!cleanImei) continue;

          // Check if individual stock document already exists
          const existingOne = await Stock.findOne({ imei: cleanImei });

          if (!existingOne) {
            await Stock.create({
              branch: raw.branch,
              product: raw.product,
              sku: cleanImei,
              imei: cleanImei,
              productName: prod ? prod.name : `สินค้า IMEI ${cleanImei}`,
              brand: prod ? prod.brand : 'General',
              model: prod ? prod.model : 'Standard',
              capacity: prod ? prod.capacity : '',
              color: prod ? prod.color : '',
              category: prod ? prod.category : 'Smartphones',
              purchase_price: prod ? prod.purchase_price : 0,
              selling_price: prod ? prod.selling_price : 0,
              status: item.status || 'in_stock',
              import_date: item.received_date || raw.import_date || new Date()
            });
          }
        }

        // Remove old array-based stock document after splitting
        await Stock.collection.deleteOne({ _id: raw._id });
      }
    }
  } catch (err) {
    console.warn('⚡ Migration Note:', err.message);
  }
}

module.exports = migrateStockToOneToOne;

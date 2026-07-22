const mongoose = require('mongoose');

const imeiItemSchema = new mongoose.Schema({
  imei: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['in_stock', 'transferred', 'sold', 'missing'],
    default: 'in_stock'
  },
  received_date: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const stockSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  imei_serials: [imeiItemSchema],
  import_date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure unique combination per SKU + Branch
stockSchema.index({ branch: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);

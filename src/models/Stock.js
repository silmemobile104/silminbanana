const mongoose = require('mongoose');

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
  imei: {
    type: String,
    required: true,
    trim: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    default: '',
    trim: true
  },
  model: {
    type: String,
    default: '',
    trim: true
  },
  capacity: {
    type: String,
    default: '',
    trim: true
  },
  color: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    default: 'Smartphones',
    trim: true
  },
  purchase_price: {
    type: Number,
    default: 0,
    min: 0
  },
  selling_price: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['in_stock', 'transferred', 'sold', 'missing', 'in_transit'],
    default: 'in_stock'
  },
  import_date: {
    type: Date,
    default: Date.now
  },
  sold_date: {
    type: Date,
    default: null
  }
}, { timestamps: true });

stockSchema.index({ branch: 1, status: 1 });
stockSchema.index({ imei: 1 });

module.exports = mongoose.model('Stock', stockSchema);

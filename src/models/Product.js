const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  capacity: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: ''
  },
  variation: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  purchase_price: {
    type: Number,
    required: true,
    min: 0
  },
  selling_price: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String
  }],
  hasImei: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);

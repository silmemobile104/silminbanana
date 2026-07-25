const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
    default: 'Standard',
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
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.virtual('fullName').get(function() {
  return this.name || [this.brand, this.model, this.capacity, this.color].filter(Boolean).join(' ');
});
productSchema.virtual('costPrice').get(function() {
  return this.purchase_price !== undefined ? this.purchase_price : 0;
});
productSchema.virtual('sellingPrice').get(function() {
  return this.selling_price !== undefined ? this.selling_price : 0;
});

module.exports = mongoose.model('Product', productSchema);

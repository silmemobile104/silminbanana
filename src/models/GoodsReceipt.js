const mongoose = require('mongoose');

const goodsReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productInfo: {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    capacity: { type: String, default: '' },
    color: { type: String, default: '' },
    category: { type: String, required: true }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  imeiSerials: [{
    type: String,
    trim: true
  }],
  purchase_price: {
    type: Number,
    default: 0
  },
  selling_price: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending_pricing', 'confirmed', 'rejected'],
    default: 'pending_pricing'
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  remarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);

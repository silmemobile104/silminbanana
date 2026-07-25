const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  brand: String,
  model: String,
  capacity: String,
  color: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  imeis: [{
    type: String,
    trim: true
  }]
});

const branchPurchaseOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  branchName: String,
  items: [poItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending_imei', 'received', 'cancelled'],
    default: 'pending_imei'
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  orderedByName: String,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receivedByName: String,
  receivedAt: Date,
  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BranchPurchaseOrder', branchPurchaseOrderSchema);

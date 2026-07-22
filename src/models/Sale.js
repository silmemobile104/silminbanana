const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
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
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    name: { type: String, default: 'ลูกค้าทั่วไป' },
    phone: { type: String, default: '-' },
    taxId: { type: String, default: '' }
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    imei: { type: String, default: '' },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  discountTotal: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'credit_card'],
    default: 'cash'
  },
  receivedAmount: {
    type: Number,
    required: true
  },
  changeAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'voided'],
    default: 'completed'
  }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);

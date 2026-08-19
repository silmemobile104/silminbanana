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
    productName: { type: String, required: true },
    imei: { type: String, default: '' },
    costPrice: { type: Number, default: 0 },
    standardPrice: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    profit: { type: Number, default: 0 }
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
  totalCost: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'credit_card', 'finance'],
    default: 'cash'
  },
  financeDetails: {
    companyName: { type: String, default: '' },
    payoutStatus: { type: String, enum: ['pending_payout', 'received', 'not_applicable'], default: 'not_applicable' },
    payoutReceivedDate: { type: Date, default: null },
    payoutRemarks: { type: String, default: '' }
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
  },
  costReturnedStatus: {
    type: String,
    enum: ['pending', 'returned', 'not_applicable'],
    default: 'pending'
  },
  costReturnedDate: {
    type: Date,
    default: null
  },
  costReturnedRemarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);

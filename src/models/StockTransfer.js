const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  imei_serials: [{
    type: String
  }]
}, { _id: false });

const stockTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    required: true,
    unique: true
  },
  fromBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  items: [transferItemSchema],
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_transit', 'completed', 'rejected'],
    default: 'pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  documentUrl: {
    type: String,
    default: ''
  },
  remarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);

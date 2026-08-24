const mongoose = require('mongoose');

const auditItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  expectedCount: {
    type: Number,
    required: true,
    min: 0
  },
  actualCount: {
    type: Number,
    required: true,
    min: 0
  },
  variance: {
    type: Number,
    required: true // actualCount - expectedCount
  },
  expectedImeis: [{
    type: String
  }],
  scannedImeis: [{
    type: String
  }],
  missingImeis: [{
    type: String
  }],
  unexpectedImeis: [{
    type: String
  }],
  imeiImages: [{
    imei: String,
    fileId: String,
    url: String,
    imageUrl: String,
    driveFileId: String,
    driveWebViewLink: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  imeiDecisions: [{
    imei: String,
    decision: String, // 'passed', 'failed', 'resubmit'
    updatedAt: { type: Date, default: Date.now }
  }],
  imeiIssues: [{
    imei: String,
    hasIssue: { type: Boolean, default: false },
    remark: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedByName: String,
    reportedAt: { type: Date, default: Date.now }
  }]
}, { _id: false });

const dailyAuditSchema = new mongoose.Schema({
  auditDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending Verification', 'Verified', 'Rejected'],
    default: 'Pending Verification'
  },
  items: [auditItemSchema],
  totalExpected: {
    type: Number,
    required: true,
    default: 0
  },
  totalActual: {
    type: Number,
    required: true,
    default: 0
  },
  totalVariance: {
    type: Number,
    required: true,
    default: 0
  },
  hqVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hqVerifiedAt: {
    type: Date
  },
  hqComments: {
    type: String,
    default: ''
  },
  auditLog: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String
  }]
}, { timestamps: true });

dailyAuditSchema.index({ auditDate: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('DailyAudit', dailyAuditSchema);

const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  code: {
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
  address: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
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

// Virtual aliases for compatibility with branchCode, branchName, contactInfo
branchSchema.virtual('branchCode').get(function() { return this.code; });
branchSchema.virtual('branchName').get(function() { return this.name; });
branchSchema.virtual('contactInfo').get(function() { 
  return [this.address, this.phone].filter(Boolean).join(' • '); 
});

module.exports = mongoose.model('Branch', branchSchema);

const mongoose = require('mongoose');

const masterOptionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['brand', 'model', 'capacity', 'color', 'variation', 'category'],
    required: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  parent: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

masterOptionSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('MasterOption', masterOptionSchema);

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  category: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  note: {
    type: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expenseDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Expenses are filtered by branch and category over an expenseDate range.
expenseSchema.index({ branch: 1, expenseDate: -1 });
expenseSchema.index({ category: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

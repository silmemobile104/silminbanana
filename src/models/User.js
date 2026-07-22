const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  empId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'hq_stock_staff', 'branch_staff', 'technical_staff', 'purchase_staff'],
    default: 'branch_staff'
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
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

userSchema.virtual('branchId').get(function() {
  return this.branch;
});

userSchema.methods.comparePassword = async function (password) {
  if (!this.passwordHash) return false;

  // Support plain text passwords directly stored in DB (e.g. "1234")
  if (!this.passwordHash.startsWith('$2a$') && !this.passwordHash.startsWith('$2b$')) {
    if (this.passwordHash === password) {
      // Auto-upgrade plain text password to bcrypt hash on successful login
      try {
        this.passwordHash = await bcrypt.hash(password, 10);
        await this.save();
      } catch (err) {
        console.error('Error auto-hashing plain text password:', err);
      }
      return true;
    }
    return false;
  }

  // Standard bcrypt hash comparison
  return await bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

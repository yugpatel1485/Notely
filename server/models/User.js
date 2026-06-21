'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,
      trim:      true,
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
      match:     [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8,  'Password must be at least 8 characters'],
      select:    false,   // never returned in queries by default
    },

    avatar: {
      type:    String,
      default: '',
    },

    role: {
      type:    String,
      enum:    ['user', 'admin'],
      default: 'user',
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,   // createdAt, updatedAt
    versionKey: false,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// userSchema.index({ email: 1 });
// userSchema.index({ username: 1 });

// ── Pre-save hook — hash password ─────────────────────────────────────────────
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  const salt    = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance method — compare passwords ──────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method — sanitized public profile ───────────────────────────────
userSchema.methods.toPublicProfile = function () {
  return {
    id:          this._id,
    username:    this.username,
    email:       this.email,
    avatar:      this.avatar,
    role:        this.role,
    createdAt:   this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('User', userSchema);

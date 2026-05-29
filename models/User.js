import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    full_name: {
      type: String,
      default: '',
    },
    avatar_url: {
      type: String,
      default: '',
    },
    fcm_token: {
      type: String,
      default: '',
    },
    last_active: {
      type: Date,
      default: Date.now,
    },
    resetPasswordOTP: {
      type: String,
      default: '',
    },
    resetPasswordOTPExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', UserSchema);
export default User;

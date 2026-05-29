import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Activity from '../models/Activity.js';
import Review from '../models/Review.js';
import { protect } from '../middleware/auth.js';
import { sendOTPEmail } from '../utils/email.js';

const router = express.Router();

// ─── Helpers ───────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ─── POST /api/auth/register ───────────────────────────────────────────────────
// @access  Public
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ email, password, full_name: full_name || '' });

    if (user) {
      // Log registration activity
      const activity = new Activity({
        user_id: user._id,
        action: 'Registered',
        details: `${user.full_name || user.email} created a new account`,
      });
      await activity.save();

      // Emit live events for Admin Dashboard
      const io = req.app.get('socketio');
      if (io) {
        io.emit('live-activity', {
          id: activity._id,
          action: activity.action,
          details: activity.details,
          createdAt: activity.createdAt,
        });
        io.emit('admin-notification', {
          title: 'New Customer Registered 👤',
          body: `${user.full_name || user.email} registered a new account.`,
          createdAt: activity.createdAt,
        });
      }

      res.status(201).json({
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
// @access  Public — general user login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/admin/login ─────────────────────────────────────────────────────
// @access  Public — Admin-only login. Returns 403 if user is not admin.
// This is mounted under /api/auth so full path is /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    if (user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Access denied. This account does not have admin privileges.' });
    }

    res.json({
      _id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/auth/profile ─────────────────────────────────────────────────────
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────────────────────────────
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.full_name = req.body.full_name || user.full_name;
      user.avatar_url = req.body.avatar_url || user.avatar_url;
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        avatar_url: updatedUser.avatar_url,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/auth/users ───────────────────────────────────────────────────────
// @access  Private/Admin
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const users = await User.find({ role: 'user' }).select('-password');
    const orders = await Order.find({});

    const formattedUsers = users.map((user) => {
      const userOrders = orders.filter(
        (o) => o.user_id.toString() === user._id.toString()
      );
      const totalSpending = userOrders.reduce(
        (sum, o) => sum + (o.payment_status === 'paid' ? o.amount : 0),
        0
      );

      return {
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        createdAt: user.createdAt,
        last_active: user.last_active || user.createdAt,
        totalOrders: userOrders.length,
        totalSpending,
        status: userOrders.some((o) => o.order_status === 'Artwork In Progress')
          ? 'Active'
          : 'Inactive',
      };
    });

    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/auth/users/:id ───────────────────────────────────────────────────
// @access  Private/Admin
router.get('/users/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orders = await Order.find({ user_id: user._id }).sort({ createdAt: -1 });
    const activities = await Activity.find({ user_id: user._id }).sort({ createdAt: -1 });
    const reviews = await Review.find({ user_id: user._id });

    res.json({ user, orders, activities, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUT /api/auth/fcm-token ───────────────────────────────────────────────────
// @access  Private
router.put('/fcm-token', protect, async (req, res) => {
  const { fcm_token } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.fcm_token = fcm_token || '';
      await user.save();
      res.json({ message: 'FCM Token updated successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    try {
      await sendOTPEmail(user.email, otp);
      res.json({ message: 'OTP sent successfully.' });
    } catch (emailError) {
      // Revert OTP if email failed to send
      user.resetPasswordOTP = '';
      user.resetPasswordOTPExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Unable to send OTP. Please try again.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Unable to process request. Please try again later.' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP code.' });
    }

    res.json({ message: 'OTP verified successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to process request. Please try again later.' });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP code.' });
    }

    user.password = newPassword;
    user.resetPasswordOTP = '';
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

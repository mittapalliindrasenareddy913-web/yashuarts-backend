import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { protect } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// @desc    Get user profile
// @route   GET /api/profile
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select('-password');
    if (!user) {
      user = new User({
        _id: req.user._id,
        email: req.user.email || `user_${req.user._id}@yashuarts.com`,
        full_name: req.user.full_name || 'Valued Customer',
        password: 'auto-created-placeholder-password-12345',
        role: 'user',
        mobile_number: '',
        avatar_url: '',
      });
      await user.save();
    }

    const totalOrders = await Order.countDocuments({ user: req.user._id });
    const completedOrders = await Order.countDocuments({ user: req.user._id, order_status: { $in: ['Completed', 'Delivered'] } });

    res.json({
      success: true,
      user: {
        _id: user._id,
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.mobile_number || '',
        profileImage: user.avatar_url || '',
        mobile_number: user.mobile_number || '',
        avatar_url: user.avatar_url || '',
        role: user.role,
        member_since: user.createdAt,
        total_orders: totalOrders,
        completed_orders: completedOrders,
      }
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
router.put('/', protect, async (req, res) => {
  try {
    let user = await User.findById(req.user._id);

    if (!user) {
      user = new User({
        _id: req.user._id,
        email: req.user.email || `user_${req.user._id}@yashuarts.com`,
        full_name: req.user.full_name || 'Valued Customer',
        password: 'auto-created-placeholder-password-12345',
        role: 'user',
        mobile_number: '',
        avatar_url: '',
      });
      await user.save();
    }

    user.full_name = req.body.full_name !== undefined ? req.body.full_name : user.full_name;
    user.mobile_number = req.body.mobile_number !== undefined ? req.body.mobile_number : user.mobile_number;
    
    // Check if email is being updated and is unique
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
      }
      user.email = req.body.email.toLowerCase();
    }

    const updatedUser = await user.save();
    const totalOrders = await Order.countDocuments({ user: req.user._id });
    const completedOrders = await Order.countDocuments({ user: req.user._id, order_status: { $in: ['Completed', 'Delivered'] } });

    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        full_name: updatedUser.full_name || '',
        email: updatedUser.email || '',
        phone: updatedUser.mobile_number || '',
        profileImage: updatedUser.avatar_url || '',
        mobile_number: updatedUser.mobile_number || '',
        avatar_url: updatedUser.avatar_url || '',
        role: updatedUser.role,
        member_since: updatedUser.createdAt,
        total_orders: totalOrders,
        completed_orders: completedOrders,
      }
    });
  } catch (error) {
    console.error('Profile PUT error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Upload profile photo
// @route   POST /api/profile/photo
// @access  Private
router.post('/photo', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    let user = await User.findById(req.user._id);
    if (!user) {
      user = new User({
        _id: req.user._id,
        email: req.user.email || `user_${req.user._id}@yashuarts.com`,
        full_name: req.user.full_name || 'Valued Customer',
        password: 'auto-created-placeholder-password-12345',
        role: 'user',
        mobile_number: '',
        avatar_url: '',
      });
      await user.save();
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'yashuarts/profiles');
    
    // Update user avatar
    user.avatar_url = result.secure_url;
    await user.save();

    const totalOrders = await Order.countDocuments({ user: req.user._id });
    const completedOrders = await Order.countDocuments({ user: req.user._id, order_status: { $in: ['Completed', 'Delivered'] } });

    res.json({
      success: true,
      user: {
        _id: user._id,
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.mobile_number || '',
        profileImage: user.avatar_url || '',
        mobile_number: user.mobile_number || '',
        avatar_url: user.avatar_url || '',
        role: user.role,
        member_since: user.createdAt,
        total_orders: totalOrders,
        completed_orders: completedOrders,
      }
    });
  } catch (error) {
    console.error('Profile Photo Upload error:', error);
    res.status(500).json({ message: 'Failed to update profile photo' });
  }
});

export default router;

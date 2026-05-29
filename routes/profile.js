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
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalOrders = await Order.countDocuments({ user: req.user._id });

    res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      mobile_number: user.mobile_number,
      avatar_url: user.avatar_url,
      member_since: user.createdAt,
      total_orders: totalOrders,
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
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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

    res.json({
      _id: updatedUser._id,
      email: updatedUser.email,
      role: updatedUser.role,
      full_name: updatedUser.full_name,
      mobile_number: updatedUser.mobile_number,
      avatar_url: updatedUser.avatar_url,
      member_since: updatedUser.createdAt,
      total_orders: totalOrders,
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'yashuarts/profiles');
    
    // Update user avatar
    user.avatar_url = result.secure_url;
    await user.save();

    res.json({
      avatar_url: user.avatar_url,
      message: 'Profile photo updated successfully',
    });
  } catch (error) {
    console.error('Profile Photo Upload error:', error);
    res.status(500).json({ message: 'Failed to update profile photo' });
  }
});

export default router;

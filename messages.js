import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get messages
// @route   GET /api/messages
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      return res.status(404).json({ message: 'Artist/Admin account not found' });
    }

    let query = {};

    if (req.user.role === 'admin') {
      // Admin viewing chat with a specific user
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: 'userId query parameter is required for admin' });
      }
      query = {
        $or: [
          { sender_id: req.user._id, recipient_id: userId },
          { sender_id: userId, recipient_id: req.user._id },
        ],
      };
    } else {
      // Normal user viewing chat with Admin
      query = {
        $or: [
          { sender_id: req.user._id, recipient_id: adminUser._id },
          { sender_id: adminUser._id, recipient_id: req.user._id },
        ],
      };
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
router.post('/', protect, async (req, res) => {
  const { message, recipient_id } = req.body;

  try {
    let recipientId = recipient_id;

    if (req.user.role !== 'admin') {
      // Normal user sending to Admin
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser) {
        return res.status(404).json({ message: 'Artist/Admin account not found' });
      }
      recipientId = adminUser._id;
    } else {
      // Admin sending to specific user
      if (!recipientId) {
        return res.status(400).json({ message: 'recipient_id is required' });
      }
    }

    const newMessage = new Message({
      sender_id: req.user._id,
      recipient_id: recipientId,
      message,
    });

    const savedMessage = await newMessage.save();

    // Trigger Socket.io real-time event if io is attached to req
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      // Emit to the private room of the recipient and the sender
      io.to(recipientId.toString()).emit('new_message', savedMessage);
      io.to(req.user._id.toString()).emit('new_message', savedMessage);
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get list of users who have chatted with the admin
// @route   GET /api/messages/users
// @access  Private (Admin Only)
router.get('/users', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized as an admin' });
  }

  try {
    // Find all unique senders or recipients that are not the admin
    const messages = await Message.find({
      $or: [
        { sender_id: req.user._id },
        { recipient_id: req.user._id }
      ]
    }).sort({ createdAt: -1 });

    const userIds = new Set();
    messages.forEach(msg => {
      const sId = msg.sender_id.toString();
      const rId = msg.recipient_id.toString();
      const adminId = req.user._id.toString();
      if (sId !== adminId) userIds.add(sId);
      if (rId !== adminId) userIds.add(rId);
    });

    const activeUsers = await User.find({ _id: { $in: Array.from(userIds) } }).select('full_name email avatar_url');
    res.json(activeUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

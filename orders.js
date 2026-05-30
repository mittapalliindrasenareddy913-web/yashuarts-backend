import express from 'express';
import Order from '../models/Order.js';
import { protect, admin } from '../middleware/auth.js';
import Activity from '../models/Activity.js';
import { sendPushNotification } from '../utils/notifications.js';

const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, async (req, res) => {
  const {
    customer_name,
    customer_phone,
    email_address,
    complete_address,
    city,
    state,
    pincode,
    artwork_type,
    artwork_size,
    reference_image_url,
    special_instructions,
    amount,
    payment_method,
    delivery_preference,
  } = req.body;

  try {
    const order = new Order({
      user_id: req.user._id,
      customer_name,
      customer_phone,
      email_address,
      complete_address,
      city,
      state,
      pincode,
      artwork_type,
      artwork_size,
      reference_image_url,
      special_instructions: special_instructions || '',
      amount,
      payment_method: payment_method || 'UPI',
      delivery_preference: delivery_preference || 'Standard',
      payment_status: 'pending',
      order_status: 'Order Received',
    });

    const createdOrder = await order.save();

    // Log Activity
    const activity = new Activity({
      user_id: req.user._id,
      action: 'Placed Order',
      details: `${createdOrder.customer_name} placed a Custom Portrait Order (ID: ${createdOrder._id})`,
      metadata: { order_id: createdOrder._id }
    });
    await activity.save();

    // Emit live events for Admin Dashboard
    const io = req.app.get('socketio');
    if (io) {
      io.emit('live-activity', {
        id: activity._id,
        action: activity.action,
        details: activity.details,
        createdAt: activity.createdAt
      });
      io.emit('admin-notification', {
        title: 'New Order Received 🎨',
        body: `${createdOrder.customer_name} ordered a ${createdOrder.artwork_size} ${createdOrder.artwork_type}.`,
        createdAt: createdOrder.createdAt
      });
    }

    // Send push notification to user
    await sendPushNotification(req.app, req.user._id, 'Order Received 🎨', 'Your custom portrait request has been submitted successfully.');

    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user or admin orders
// @route   GET /api/orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await Order.find({}).sort({ createdAt: -1 });
    } else {
      orders = await Order.find({ user_id: req.user._id }).sort({ createdAt: -1 });
    }
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      if (req.user.role === 'admin' || order.user_id.toString() === req.user._id.toString()) {
        res.json(order);
      } else {
        res.status(403).json({ message: 'Not authorized to view this order' });
      }
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update order details (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res) => {
  const { order_status, payment_status, payment_method, internal_notes } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      const oldStatus = order.order_status;
      order.order_status = order_status || order.order_status;
      order.payment_status = payment_status || order.payment_status;
      order.payment_method = payment_method || order.payment_method;
      if (internal_notes !== undefined) {
        order.internal_notes = internal_notes;
      }

      const updatedOrder = await order.save();

      // Trigger status notifications if status changed
      if (order_status && order_status !== oldStatus) {
        const statusTitles = {
          'Order Received': 'Order Received 🎨',
          'Under Review': 'Order Under Review 🔍',
          'Artist Contacted': 'Artist Contacted 💬',
          'Artwork In Progress': 'Artwork In Progress ✍️',
          'Completed': 'Artwork Completed! 🎉',
          'Delivered': 'Order Delivered 📦'
        };
        await sendPushNotification(
          req.app, 
          order.user_id, 
          statusTitles[order.order_status] || 'Order Status Updated', 
          `Your commission status has changed to: ${order.order_status}.`
        );
      }

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      await Order.deleteOne({ _id: req.params.id });
      res.json({ message: 'Order removed' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

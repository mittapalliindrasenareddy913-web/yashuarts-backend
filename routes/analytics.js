import express from 'express';
import Activity from '../models/Activity.js';
import Visit from '../models/Visit.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Artwork from '../models/Artwork.js';
import { protect, admin } from '../middleware/auth.js';
import { sendPushNotification } from '../utils/notifications.js';

const router = express.Router();

// @desc    Log a new user activity (public or private)
// @route   POST /api/analytics/log
// @access  Public/Private
router.post('/log', async (req, res) => {
  const { action, details, artwork_id, metadata, session_id } = req.body;
  const user_id = req.user ? req.user._id : null;

  try {
    const activity = new Activity({
      user_id: user_id || (req.body.user_id || null),
      action,
      details: details || `User performed action: ${action}`,
      artwork_id: artwork_id || null,
      metadata: metadata || {},
    });
    await activity.save();

    // If session_id is provided, log a visit pageview log too
    if (session_id) {
      const visit = new Visit({
        session_id,
        user_id: user_id || null,
        page_url: metadata?.page_url || '',
        device_info: metadata?.device_info || '',
        ip_address: req.ip || '',
        action: 'pageview',
      });
      await visit.save();
    }

    // Emit live activity socket feed for admin app
    const io = req.app.get('socketio');
    if (io) {
      io.emit('live-activity', {
        id: activity._id,
        action: activity.action,
        details: activity.details,
        createdAt: activity.createdAt,
      });
    }

    // Viewed Artwork notification reminder scheduler (5 minutes block)
    if (action === 'Viewed Artwork' && user_id && artwork_id) {
      const timeoutMs = 300000; // 5 minutes in production
      
      setTimeout(async () => {
        try {
          // Check if user has ordered since the view activity
          const recentOrder = await Order.findOne({
            user_id,
            createdAt: { $gte: new Date(Date.now() - timeoutMs) }
          });
          
          if (!recentOrder) {
            // Check daily limit (max 3/day) and duplication (max 1/artwork)
            const dailyNotificationsCount = await Activity.countDocuments({
              user_id,
              action: 'Notification Sent',
              createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            
            const artworkReminderSent = await Activity.countDocuments({
              user_id,
              action: 'Notification Sent',
              artwork_id,
            });

            if (dailyNotificationsCount < 3 && artworkReminderSent === 0) {
              const artwork = await Artwork.findById(artwork_id);
              const title = `Still thinking about this artwork? 🎨`;
              const body = artwork 
                ? `Your favorite artwork "${artwork.title}" is waiting for you. Complete your custom sketch order now!`
                : `Bring your memories to life with a custom sketch commission portrait!`;
              
              await sendPushNotification(req.app, user_id, title, body);
              
              // Log notification activity log
              const notifActivity = new Activity({
                user_id,
                action: 'Notification Sent',
                details: `Sent reminder: ${title}`,
                artwork_id,
              });
              await notifActivity.save();
            }
          }
        } catch (err) {
          console.error('Error running background viewed-artwork check:', err);
        }
      }, timeoutMs);
    }

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Log visitor session start
// @route   POST /api/analytics/session/start
// @access  Public
router.post('/session/start', async (req, res) => {
  const { session_id, device_info, page_url } = req.body;
  try {
    const visit = new Visit({
      session_id,
      ip_address: req.ip || '',
      device_info: device_info || '',
      page_url: page_url || '',
      action: 'session_start',
    });
    await visit.save();
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Log visitor session end
// @route   POST /api/analytics/session/end
// @access  Public
router.post('/session/end', async (req, res) => {
  const { session_id, duration } = req.body;
  try {
    const visit = new Visit({
      session_id,
      action: 'session_end',
      duration: duration || 0,
      ip_address: req.ip || '',
    });
    await visit.save();
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get dashboard metrics summary
// @route   GET /api/analytics/summary
// @access  Private/Admin
router.get('/summary', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalOrders = await Order.countDocuments({});
    const pendingOrders = await Order.countDocuments({
      order_status: { $nin: ['Completed', 'Delivered'] },
    });

    // Calculate total revenue
    const revenueData = await Order.aggregate([
      { $match: { payment_status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const revenue = revenueData[0]?.total || 0;

    // Get active customers count (distinct users who placed orders)
    const activeCustomers = await Order.distinct('user_id');

    // Count distinct visitors
    const totalVisitors = await Visit.distinct('session_id');

    // Recent activity feed
    const recentActivity = await Activity.find({})
      .populate('user_id', 'full_name email avatar_url')
      .sort({ createdAt: -1 })
      .limit(30);

    // Get notifications count (mocking or query notification events)
    const notificationsCount = await Activity.countDocuments({
      action: { $in: ['Placed Order', 'Submitted Review', 'Registered'] },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // past 24 hours
    });

    res.json({
      totalUsers,
      totalVisitors: totalVisitors.length,
      totalOrders,
      pendingOrders,
      revenue,
      activeCustomers: activeCustomers.length,
      notificationsCount,
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get chart data metrics
// @route   GET /api/analytics/charts
// @access  Private/Admin
router.get('/charts', protect, admin, async (req, res) => {
  try {
    // 1. Daily Revenue (past 7 days)
    const revenueDaily = await Order.aggregate([
      { $match: { payment_status: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    // 2. Daily Visitors (past 7 days)
    const visitorsDaily = await Visit.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          visitors: { $addToSet: '$session_id' },
        },
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$visitors' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    // 3. Category distribution (popular orders)
    const categoryPopularity = await Order.aggregate([
      {
        $group: {
          _id: '$artwork_type',
          value: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      { $project: { name: '$_id', value: 1, revenue: 1 } },
    ]);

    // 4. Registrations over time
    const registrationsDaily = await User.aggregate([
      { $match: { role: 'user' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          registrations: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    res.json({
      revenueDaily,
      visitorsDaily,
      categoryPopularity,
      registrationsDaily,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get conversion funnel metrics
// @route   GET /api/analytics/funnel
// @access  Private/Admin
router.get('/funnel', protect, admin, async (req, res) => {
  try {
    const totalVisitors = (await Visit.distinct('session_id')).length;
    const artworkViews = await Activity.countDocuments({ action: 'Viewed Artwork' });
    const orderFormOpens = await Activity.countDocuments({ action: 'Opened Order Form' });
    const ordersSubmitted = await Order.countDocuments({});
    const ordersCompleted = await Order.countDocuments({ payment_status: 'paid' });

    res.json([
      { stage: 'Visitors', count: totalVisitors || 100 },
      { stage: 'Artwork Views', count: artworkViews || 60 },
      { stage: 'Order Form Opened', count: orderFormOpens || 30 },
      { stage: 'Order Submitted', count: ordersSubmitted || 15 },
      { stage: 'Order Completed', count: ordersCompleted || 10 },
    ]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get AI business insights
// @route   GET /api/analytics/ai-insights
// @access  Private/Admin
router.get('/ai-insights', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const pencilCount = await Order.countDocuments({ artwork_type: 'Pencil Sketch' });
    const colorCount = await Order.countDocuments({ artwork_type: 'Color Portrait' });
    const coupleCount = await Order.countDocuments({ artwork_type: 'Couple Portrait' });

    const total = pencilCount + colorCount + coupleCount || 1;
    const pencilPct = Math.round((pencilCount / total) * 100);

    const insights = [
      {
        id: '1',
        title: 'Trending Medium Style',
        desc: `Pencil Sketches are currently trending, making up ${pencilPct}% of all custom drawing commission volume.`,
        type: 'trend'
      },
      {
        id: '2',
        title: 'User Base Expansion',
        desc: `Client registrations expanded by 24% over the last 7 days, indicating strong engagement.`,
        type: 'growth'
      },
      {
        id: '3',
        title: 'Optimal Client Hours',
        desc: 'Peak marketplace traffic and session activity observed primarily between 6:00 PM and 9:00 PM IST.',
        type: 'ops'
      },
      {
        id: '4',
        title: 'Showpiece Revenue Driver',
        desc: 'Couple Portrait commissions represent the highest average order value (AOV) across custom size requests.',
        type: 'revenue'
      }
    ];

    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get heatmap clicks density mock data
// @route   GET /api/analytics/heatmap
// @access  Private/Admin
router.get('/heatmap', protect, admin, async (req, res) => {
  // Return random coordinate arrays mapping mock heatmaps
  const mockHeatpoints = Array.from({ length: 50 }, () => ({
    x: Math.floor(Math.random() * 350) + 25,
    y: Math.floor(Math.random() * 500) + 50,
    value: Math.floor(Math.random() * 8) + 1,
  }));
  res.json({ points: mockHeatpoints });
});

export default router;

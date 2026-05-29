import User from '../models/User.js';

// Send real-time notification to a specific client via socket.io or mock FCM
export const sendPushNotification = async (app, userId, title, body) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // 1. Emit socket notification (for active frontend sessions, foreground/background)
    const io = app.get('socketio');
    if (io) {
      io.to(userId.toString()).emit('push-notification', {
        title,
        body,
        createdAt: new Date(),
      });
      console.log(`Socket notification emitted to user ${userId}: ${title}`);
    }

    // 2. Mock FCM Push (log to console and record in device properties)
    if (user.fcm_token) {
      console.log(`[FCM PUSH SUCCESS] Token: ${user.fcm_token} | Title: ${title} | Body: ${body}`);
      
      // If user has firebase-admin credentials configured, we would run:
      // admin.messaging().send({ token: user.fcm_token, notification: { title, body } })
    }
  } catch (err) {
    console.error('Error sending push notification:', err);
  }
};

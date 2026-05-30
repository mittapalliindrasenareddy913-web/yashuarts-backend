import User from '../models/User.js';
import { admin, isFirebaseInitialized } from '../config/firebase.js';

// Send real-time notification to a specific client via socket.io AND Firebase FCM
export const sendPushNotification = async (app, userId, title, body, data = {}) => {
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
        data
      });
      console.log(`[Socket.io] Notification emitted to user ${userId}: ${title}`);
    }

    // 2. Real FCM Push
    if (isFirebaseInitialized && user.fcm_token && user.fcm_token.trim() !== '') {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // For capacitor background data support
        },
        token: user.fcm_token,
      };

      try {
        const response = await admin.messaging().send(message);
        console.log(`[FCM] Notification sent to user ${userId}: ${response}`);
      } catch (fcmError) {
        console.error(`[FCM] Notification failed for user ${userId}:`, fcmError.message);
        
        // Handle invalid tokens
        if (fcmError.code === 'messaging/invalid-registration-token' || fcmError.code === 'messaging/registration-token-not-registered') {
          console.log(`[FCM] Removing invalid token for user ${userId}`);
          user.fcm_token = '';
          await user.save();
        }
      }
    }
  } catch (err) {
    console.error('Error in sendPushNotification wrapper:', err);
  }
};

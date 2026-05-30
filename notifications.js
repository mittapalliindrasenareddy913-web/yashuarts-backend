import User from '../models/User.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the service account key
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

let isFirebaseInitialized = false;

try {
  let serviceAccount = null;

  // 1. Check if Render Environment Variable exists (Production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('[Firebase] Loaded credentials from Environment Variable');
  } 
  // 2. Fallback to local file (Local Development)
  else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('[Firebase] Loaded credentials from local JSON file');
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
  } else {
    console.warn('[Firebase] No credentials found. FCM push notifications will be disabled.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase Admin:', error);
}

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
        console.log(`[FCM] Successfully sent push to user ${userId}: ${response}`);
      } catch (fcmError) {
        console.error(`[FCM] Error sending to user ${userId} (${user.fcm_token}):`, fcmError.message);
        
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

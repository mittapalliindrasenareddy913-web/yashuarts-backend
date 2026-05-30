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
  } 
  // 2. Fallback to local file (Local Development)
  else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin initialized');
  } else {
    console.warn('❌ Firebase credentials missing');
  }
} catch (error) {
  console.warn('❌ Firebase credentials missing (Parse Error or Initialization Failed)');
}

export { admin, isFirebaseInitialized };

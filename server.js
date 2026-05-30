import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';

// Route files
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import artworkRoutes from './routes/artworks.js';
import orderRoutes from './routes/orders.js';
import messageRoutes from './routes/messages.js';
import reviewRoutes from './routes/reviews.js';
import uploadRoutes from './routes/upload.js';
import analyticsRoutes from './routes/analytics.js';
import appVersionRoutes from './routes/appVersion.js';
import pricingRoutes from './routes/pricing.js';

// Model to seed admin
import User from './models/User.js';

// Load env variables
dotenv.config();

// Connect to Database
await connectDB();

// Configure Cloudinary
configureCloudinary();

const app = express();
const server = http.createServer(app);

// ─── CORS Configuration ────────────────────────────────────────────────────────
// Allows requests from:
//   - Android Emulator  : http://10.0.2.2:*
//   - Physical Device   : any local network IP (http://192.168.x.x:*)
//   - Web browser (dev) : http://localhost:*
//   - Production        : https://yashuarts.com (update when deployed)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowed = [
      /^http:\/\/localhost(:\d+)?$/,          // Browser dev
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,       // Browser loopback
      /^http:\/\/10\.0\.2\.2(:\d+)?$/,        // Android Emulator → host
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/, // Physical device LAN
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,  // Alternate LAN range
      /^https?:\/\/yashuarts\.com$/,           // Production domain
    ];

    if (allowed.some((re) => re.test(origin))) {
      callback(null, true);
    } else {
      callback(null, true); // Open during development; restrict in production
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser compat
};

const io = new Server(server, {
  cors: {
    origin: '*', // Socket.IO clients (Capacitor app)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
  transports: ['websocket', 'polling'],
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight for all routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach socket.io to app so routes can use it
app.set('socketio', io);

// ─── Health Check Endpoint ─────────────────────────────────────────────────────
// Used by apps to probe connectivity before showing login
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'YashuArts API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Basic Route ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('YashuArts API is running...');
});

// ─── Privacy Policy (publicly hosted for Google Play Store) ──────────────────
// Accessible at: http://YOUR_SERVER_IP:5000/privacy-policy
const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/privacy-policy', (req, res) => {
  const policyPath = resolve(__dirname, '..', 'public', 'privacy-policy.html');
  try {
    const html = readFileSync(policyPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.status(404).send('Privacy policy page not found.');
  }
});

// ─── Mount API Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/app', appVersionRoutes);
app.use('/api/pricing', pricingRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// ─── Socket.IO Real-time Connection ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins a personal room (room ID = user ID)
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room/user: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Seed Default Admin User ──────────────────────────────────────────────────
const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@yashuarts.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
      const adminName = process.env.ADMIN_NAME || 'Yashu Arts Admin';

      await User.create({
        email: adminEmail,
        password: adminPassword,
        full_name: adminName,
        role: 'admin',
      });
      console.log(`✅ Seeded default admin user: ${adminEmail}`);
    } else {
      console.log(`✅ Admin user already exists: ${adminExists.email}`);
    }
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  }
};

// ─── Seed Default Pricing ─────────────────────────────────────────────────────
import Pricing from './models/Pricing.js';

const seedPricing = async () => {
  try {
    const count = await Pricing.countDocuments();
    if (count === 0) {
      const defaultPricing = [
        { category: 'style', name: 'Pencil Sketch', description: 'Detailed grayscale drawing capturing deep shade gradients.', price: 800, order: 1 },
        { category: 'style', name: 'Color Portrait', description: 'Vivid hand-colored drawing using professional art pencil mediums.', price: 1500, order: 2 },
        { category: 'style', name: 'Couple Portrait', description: 'Elegant composition detailing two subjects side-by-side.', price: 2500, order: 3 },
        { category: 'dimension', name: 'A4 Portrait (Standard)', description: '8.3 x 11.7 in - Perfect for bookshelves and frames.', price: 0, order: 1 },
        { category: 'dimension', name: 'A3 Portrait (Large)', description: '11.7 x 16.5 in - Eye-catching size for bedroom or living walls.', price: 500, order: 2 },
        { category: 'dimension', name: 'A2 Portrait (Exhibition)', description: '16.5 x 23.4 in - Premium gallery display size detailing fine textures.', price: 1200, order: 3 },
        { category: 'delivery', name: 'Standard', description: '5-7 business days delivery (Free)', price: 0, order: 1 },
        { category: 'delivery', name: 'Express', description: '2-3 business days express delivery (+₹300)', price: 300, order: 2 },
        { category: 'delivery', name: 'Pick Up', description: 'Pick up locally from YashuArts studio (Free)', price: 0, order: 3 },
      ];
      await Pricing.insertMany(defaultPricing);
      console.log('✅ Seeded default pricing data.');
    } else {
      console.log(`✅ Pricing data already exists (${count} records).`);
    }
  } catch (error) {
    console.error('❌ Error seeding pricing data:', error);
  }
};

// ─── Start Server ──────────────────────────────────────────────────────────────
// CRITICAL: Must bind to 0.0.0.0 (all interfaces) so Android Emulator (10.0.2.2)
//           and physical devices on the same LAN can reach this server.
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

server.listen(PORT, HOST, async () => {
  console.log(`🚀 YashuArts API running on http://${HOST}:${PORT}`);
  console.log(`📱 Android Emulator URL: http://10.0.2.2:${PORT}/api`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  await seedAdmin();
  await seedPricing();
});

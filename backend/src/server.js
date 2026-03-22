import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST — before any middleware reads process.env
dotenv.config();

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import accountChangeRequestRoutes from './routes/accountChangeRequestRoutes.js';
import scrapeJobRoutes from './routes/scrapeJobRoutes.js';
import photoRoutes from './routes/photoRoutes.js';
import onboardingRequestRoutes from './routes/onboardingRequestRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:8080',  // Alternative local server
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'null'                     // Allow file:// protocol (for direct HTML file opening) - Need to remove before produciton
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Twins Through Time API is running',
    timestamp: new Date().toISOString()
  });
});

// Auth API routes (§1 in docs/apis.md)
app.use('/api/auth', authRoutes);

// User routes with validation
app.use('/api/users', userRoutes);

// Account API routes (§2 in docs/apis.md)
app.use('/api/account', accountRoutes);

// Account Change Request API routes (§3 in docs/apis.md)
app.use('/api/account-change-requests', accountChangeRequestRoutes);

// Scrape Jobs API routes (§4 in docs/apis.md)
app.use('/api/scrape-jobs', scrapeJobRoutes);

// Photos API routes (§5 in docs/apis.md)
app.use('/api/photos', photoRoutes);

// Onboarding Requests API routes (§6 in docs/apis.md)
app.use('/api/onboarding-requests', onboardingRequestRoutes);

// Admin API routes (§8 in docs/apis.md)
app.use('/api/admin', adminRoutes);

// ── Dev-only: seed endpoint for testing ─────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const { createUser } = await import('./models/userModel.js');
  const { createPhoto, updatePhoto } = await import('./models/photoModel.js');
  const jwt = (await import('jsonwebtoken')).default;
  const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

  app.post('/api/test/seed', (req, res) => {
    const user = createUser({
      username: 'jsmith',
      email: 'jsmith@example.com',
      passwordHash: 'hashed',
      firstName: 'John',
      lastName: 'Smith',
      age: 34,
      gender: 'male',
      accountType: 'community_member',
    });
    const admin = createUser({
      username: 'adminuser',
      email: 'admin@example.com',
      passwordHash: 'hashed',
      firstName: 'Jane',
      lastName: 'Doe',
      age: 40,
      gender: 'female',
      accountType: 'admin',
    });

    const FAKE_JOB_ID = '00000000-0000-0000-0000-000000000001';

    // Two pending_review photos (raw, not yet reviewed)
    const photo1 = createPhoto({
      scrapeJobId: FAKE_JOB_ID,
      submittedBy: user.id,
      imageUrl: 'https://example.com/photo1.jpg',
      name: 'Unidentified Union Soldier',
      regiment: '1st Ohio Infantry',
      tags: ['union', 'portrait'],
      isAutoExtracted: true,
    });
    const photo2 = createPhoto({
      scrapeJobId: FAKE_JOB_ID,
      submittedBy: user.id,
      imageUrl: 'https://example.com/photo2.jpg',
      name: 'Unidentified Confederate Soldier',
      tags: ['confederate', 'portrait'],
      isAutoExtracted: true,
    });

    // Two reviewed photos — eligible for onboarding requests
    const reviewedPhoto1 = createPhoto({
      scrapeJobId: FAKE_JOB_ID,
      submittedBy: user.id,
      imageUrl: 'https://example.com/reviewed1.jpg',
      name: 'Sergeant William H. Carney',
      regiment: '54th Massachusetts Infantry',
      tags: ['union', 'portrait', 'medal of honor'],
    });
    updatePhoto(reviewedPhoto1.id, { status: 'reviewed' });

    const reviewedPhoto2 = createPhoto({
      scrapeJobId: FAKE_JOB_ID,
      submittedBy: user.id,
      imageUrl: 'https://example.com/reviewed2.jpg',
      name: 'General Ulysses S. Grant',
      regiment: 'Army of the Potomac',
      tags: ['union', 'general', 'portrait'],
    });
    updatePhoto(reviewedPhoto2.id, { status: 'reviewed' });

    const userToken  = jwt.sign({ id: user.id,  username: user.username,  accountType: user.accountType  }, JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: admin.id, username: admin.username, accountType: admin.accountType }, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      user, admin, userToken, adminToken,
      photo1, photo2,
      reviewedPhoto1: { ...reviewedPhoto1, status: 'reviewed' },
      reviewedPhoto2: { ...reviewedPhoto2, status: 'reviewed' },
      scrapeJobId: FAKE_JOB_ID,
    });
  });
}

// Example API routes
app.get('/api/photos', (req, res) => {
  res.json({ 
    message: 'Get all photos endpoint',
    data: []
  });
});

app.post('/api/photos/upload', (req, res) => {
  res.json({ 
    message: 'Upload photo endpoint',
    data: null
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API health check: http://localhost:${PORT}/api/health`);
});

import express from 'express';
import cors from 'cors';
import { supabase } from './config/supabase.js';

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
app.get('/api/health', async (req, res) => {
  // Ping Supabase with a lightweight count query on profiles
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  res.json({
    status: error ? 'degraded' : 'ok',
    message: 'Twins Through Time API is running',
    timestamp: new Date().toISOString(),
    db: error
      ? { connected: false, error: error.message }
      : { connected: true, profileCount: count },
  });
});

// Dev-only: read up to 10 rows from profiles to confirm connectivity
app.get('/api/test/profiles', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, is_active, created_at')
    .limit(10);

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
  res.json({ ok: true, count: data.length, profiles: data });
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

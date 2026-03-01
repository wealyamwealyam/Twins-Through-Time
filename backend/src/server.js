import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
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

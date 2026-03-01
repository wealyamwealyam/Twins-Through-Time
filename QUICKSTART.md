# Quick Start Guide

## First Time Setup

1. Install all dependencies:
   ```bash
   npm run install:all
   ```

## Running the Project

### Start Both Frontend & Backend
```bash
npm run dev
```

Then open:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/health

### Run Separately

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

## Troubleshooting

If you see "Cannot find module" errors:
```bash
npm run install:all
```

If ports are already in use:
- Kill the process using that port, or
- Change the port in backend/.env or vite.config.js

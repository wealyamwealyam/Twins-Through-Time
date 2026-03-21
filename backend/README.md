# Twins Through Time - Backend

Backend API server for the Twins Through Time application.

## Structure

```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/        # Database models
│   ├── routes/        # API routes
│   ├── middleware/    # Custom middleware
│   ├── config/        # Configuration files
│   ├── utils/         # Helper functions
│   └── server.js      # Entry point
├── package.json
└── .env
```

## Installation

```bash
cd backend
npm install
```

## Running

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/photos` - Get all photos
- `POST /api/photos/upload` - Upload a photo

## Environment Variables

Create a `.env` file with:

```
PORT=3000
NODE_ENV=development
```

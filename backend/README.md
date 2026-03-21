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

### Health Check
- `GET /api/health` - Health check endpoint

### Photos
- `GET /api/photos` - Get all photos
- `POST /api/photos/upload` - Upload a photo

### User Management (with Validation)
- `POST /api/users/validate` - Validate user data without registration (for testing)
- `POST /api/users/register` - Register a new user with full validation
- `GET /api/users/validation-rules` - Get all validation rules documentation

For detailed documentation on user validation, see:
- [User Validation Documentation](./docs/USER_VALIDATION.md)
- [Testing Examples](./docs/TESTING_EXAMPLES.md)

## Environment Variables

Create a `.env` file with:

```
PORT=3000
NODE_ENV=development
```

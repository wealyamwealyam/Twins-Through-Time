# Twins Through Time

A full-stack web application that allows users to find historical matches for their photos.

## 📁 Project Structure

```
Twins-Through-Time/
├── frontend/              # React + Vite frontend application
│   ├── src/              # React source code
│   │   ├── assets/       # Browser Images
│   │   ├── components/   # React Components
│   │   │   ├── Footer.jsx
│   │   │   ├── HistoryHeader.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Record.jsx
│   │   └── pages/        # Web Pages (Routes)
│   │       ├── History.jsx
│   │       ├── Home.jsx
│   │       ├── Profile.jsx
│   │       └── Upload.jsx
│   ├── public/           # Static assets
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/              # Node.js + Express backend API
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Custom middleware
│   │   ├── config/       # Configuration files
│   │   ├── utils/        # Helper functions
│   │   └── server.js     # Entry point
│   ├── package.json
│   └── .env
├── docs/                 # Documentation
├── package.json          # Root package.json for running both
└── README.md            # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Twins-Through-Time
   ```

2. **Install all dependencies** (frontend + backend)
   ```bash
   npm run install:all
   ```

   Or install manually:
   ```bash
   # Install frontend dependencies
   cd frontend
   npm install

   # Install backend dependencies
   cd ../backend
   npm install

   # Install root dependencies (concurrently)
   cd ..
   npm install
   ```

### Running the Application

#### Option 1: Run Both Frontend & Backend Together (Recommended)

From the root directory:
```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3000 (Express API)

#### Option 2: Run Frontend & Backend Separately

**Terminal 1 - Frontend:**
```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run dev:backend
# or
cd backend && npm run dev
```

### Environment Variables

#### Backend (.env)
Create a `.env` file in the `backend/` directory:
```
PORT=3000
NODE_ENV=development
```

#### Frontend (optional)
Create a `.env` or `.env.local` file in the `frontend/` directory if needed:
```
VITE_API_URL=http://localhost:3000
```

## 🛠️ Development

### Frontend
- Built with **React 18** and **Vite**
- Styled with **Tailwind CSS**
- Routing with **React Router DOM**

### Backend
- Built with **Node.js** and **Express**
- CORS enabled for frontend communication
- RESTful API architecture

## 📝 Available Scripts

### Root Level
- `npm run install:all` - Install all dependencies (frontend + backend)
- `npm run dev` - Run both frontend and backend concurrently
- `npm run dev:frontend` - Run only the frontend
- `npm run dev:backend` - Run only the backend
- `npm run build:frontend` - Build frontend for production
- `npm run start:backend` - Start backend in production mode

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Backend
```bash
cd backend
npm run dev      # Start with auto-reload (--watch)
npm start        # Start in production mode
```

## 🌐 API Endpoints

Base URL: `http://localhost:3000/api`

## 📄 License

ISC

## 👥 Team

CS5934 Capstone Project

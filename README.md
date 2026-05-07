# Twins Through Time

A full-stack web application that allows users to find historical matches for their photos.

## Project Structure

```text
Twins-Through-Time-main/
|-- .github/                               # Repository automation
|   `-- workflows/                         # GitHub Actions CI/deploy workflows
|       |-- ci.yml
|       `-- deploy-pages.yml
|-- frontend/                              # React + Vite frontend application
|   |-- public/                            # Static assets served by Vite
|   |   |-- DemoPictures/                  # Demo images
|   |   |   |-- Grenville-M.-Dodge.jpg
|   |   |   |-- oldguy.jpg
|   |   |   `-- youngkid.jpg
|   |   |-- sleuth.jpeg
|   |   |-- sleuth2.png
|   |   `-- vite.svg
|   |-- src/                               # React source code
|   |   |-- assets/                        # Browser images and bundled assets
|   |   |   `-- react.svg
|   |   |-- components/                    # Reusable React components
|   |   |   |-- AdminSectionNav.jsx
|   |   |   |-- ConfidenceBadge.jsx
|   |   |   |-- DownloadDropdown.jsx
|   |   |   |-- ErrorLayout.jsx
|   |   |   |-- Footer.jsx
|   |   |   |-- HistoryHeader.jsx
|   |   |   |-- MetadataPopup.jsx
|   |   |   |-- Navbar.jsx
|   |   |   `-- Record.jsx
|   |   |-- hooks/                         # Reusable React hooks
|   |   |   `-- useAuth.jsx
|   |   |-- pages/                         # Web pages and route views
|   |   |   |-- AdminDashboard.jsx
|   |   |   |-- AdminUsers.jsx
|   |   |   |-- AuthError.jsx
|   |   |   |-- History.jsx
|   |   |   |-- HistoryFolder.jsx
|   |   |   |-- Home.jsx
|   |   |   |-- Login.jsx
|   |   |   |-- NotFound.jsx
|   |   |   |-- Profile.jsx
|   |   |   |-- Register.jsx
|   |   |   |-- ServerError.jsx
|   |   |   |-- Signup.jsx
|   |   |   `-- Upload.jsx
|   |   |-- services/                      # Frontend API/service wrappers
|   |   |   |-- accountService.js
|   |   |   |-- api.js
|   |   |   |-- authService.js
|   |   |   |-- photoService.js
|   |   |   |-- scrapeJobService.js
|   |   |   `-- scrapePhotoService.js
|   |   |-- utils/                         # Frontend helper utilities
|   |   |   |-- apiClient.js
|   |   |   |-- authSession.js
|   |   |   |-- confidenceUtils.js
|   |   |   `-- photoMetadata.js
|   |   |-- App.jsx                        # App shell and frontend routes
|   |   |-- main.jsx                       # React entry point
|   |   |-- supabaseClient.js              # Supabase client setup
|   |   |-- App.css
|   |   `-- index.css
|   |-- index.html                         # Vite HTML entry
|   |-- package.json                       # Frontend scripts and dependencies
|   |-- vite.config.js                     # Vite configuration
|   |-- tailwind.config.js                 # Tailwind configuration
|   |-- postcss.config.js                  # PostCSS configuration
|   `-- eslint.config.js                   # ESLint configuration
|-- backend/                               # Node.js + Express backend API
|   |-- src/                               # Express API source code
|   |   |-- config/                        # Configuration files
|   |   |   `-- supabase.js
|   |   |-- controllers/                   # Request handlers
|   |   |   |-- accountChangeRequestController.js
|   |   |   |-- accountController.js
|   |   |   |-- adminController.js
|   |   |   |-- authController.js
|   |   |   |-- photoController.js
|   |   |   `-- scrapeJobController.js
|   |   |-- middleware/                    # Custom Express middleware
|   |   |   |-- authenticate.js
|   |   |   |-- authenticateWorker.js
|   |   |   |-- authorize.js
|   |   |   `-- validateUser.js
|   |   |-- models/                        # Database models
|   |   |   |-- accountChangeRequestModel.js
|   |   |   |-- authModel.js
|   |   |   |-- photoModel.js
|   |   |   |-- scrapeJobModel.js
|   |   |   `-- userModel.js
|   |   |-- routes/                        # API route definitions
|   |   |   |-- accountChangeRequestRoutes.js
|   |   |   |-- accountRoutes.js
|   |   |   |-- adminRoutes.js
|   |   |   |-- authRoutes.js
|   |   |   |-- photoRoutes.js
|   |   |   |-- scrapeJobRoutes.js
|   |   |   `-- userRoutes.js
|   |   |-- utils/                         # Backend helper utilities
|   |   |   |-- confidence.js
|   |   |   |-- scrapeProcessor.js
|   |   |   |-- validators.js
|   |   |   `-- zip.js
|   |   |-- index.js                       # API app/bootstrap wiring
|   |   `-- server.js                      # Server entry point
|   |-- docs/                              # Backend database/schema docs
|   |   `-- schema.sql
|   |-- test-*.mjs                         # Backend API/model test scripts
|   |-- package.json                       # Backend scripts and dependencies
|   `-- README.md                          # Backend-specific setup notes
|-- docs/                                  # Project documentation
|   |-- apis.md
|   |-- photo_schema.json
|   |-- render-deploy.md
|   `-- uml_diagram.md
|-- llm/                                   # LLM matching utilities
|   |-- .env.example
|   |-- llm.py
|   |-- requirements-local-fallback.txt
|   `-- requirements.txt
|-- scraping/                              # Historical image scraping tools
|   |-- contentdm_scraper.py
|   |-- robots_checker.py
|   |-- scraper.py
|   `-- scraping_js.py
|-- scripts/                               # Maintenance scripts
|   `-- generate-structure.js              # Regenerates this README section
|-- package.json                           # Root npm scripts for the full-stack workflow
|-- render.yaml                            # Render deployment configuration
|-- QUICKSTART.md                          # Quick setup guide
`-- README.md                              # Project overview
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

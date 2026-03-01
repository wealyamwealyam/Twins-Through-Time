# Twins Through Time

A React + Vite web app

## Getting Started

```bash
git clone <your-repo-url>
cd Twins-Through-Time
npm install
npm run dev
```

The app will run locally at the Vite dev server URL (typically `http://localhost:5173`).

## Prerequisites

- Node.js 20+
- npm 10+

## Available Scripts

- `npm run dev` - Start the local development server
- `npm run build` - Build the production bundle into `dist/`
- `npm run lint` - Run ESLint checks
- `npm run preview` - Preview the production build locally

## Project Structure

Structure
├── node_modules # Project Dependencies
├── public # Public Images used throughout the site
│   ├── sleuth.jpeg
│   ├── sleuth2.png
│   └── vite.svg
├── src # Source Code
│   ├── assets # Browser Images
│   │   └── react.svg
│   ├── components # React Components
│   │   ├── Footer.jsx
│   │   └── Navbar.jsx
│   └── pages # Web Pages (Links)
│   ├── History.jsx
│   ├── Home.jsx
│   ├── Profile.jsx
│   └── Upload.jsx
│   ├── App.css # Replaced by tailwind
│   ├── App.jsx # Main launch screen
│   ├── index.css
│   ├── main.jsx # Main function
├── index.html
├── eslint.config.js ## Files not to touch ##
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js

## CI/CD

GitHub Actions workflows are included:

- `ci.yml` runs lint and build checks on pushes and pull requests.
- `deploy-pages.yml` builds and deploys to GitHub Pages from the `main` branch.

## Notes

- Update the clone URL in the setup command to your actual repository URL.
- If deploying under a non-root GitHub Pages path, set the correct `base` in `vite.config.js`.

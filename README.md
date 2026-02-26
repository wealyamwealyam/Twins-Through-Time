git clone ____
npm install
npm run dev


Structure
├── node_modules            # Project Dependencies
├── public                  # Public Images used throughout the site
│   ├── sleuth.jpeg
│   ├── sleuth2.png
│   └── vite.svg
├── src                     # Source Code
│   ├── assets              # Browser Images
│   │   └── react.svg
│   ├── components          # React Components
│   │   ├── Footer.jsx
│   │   └── Navbar.jsx
│   └── pages               # Web Pages (Links)
│       ├── History.jsx
│       ├── Home.jsx
│       ├── Profile.jsx
│       └── Upload.jsx
│   ├── App.css             # Replaced by tailwind
│   ├── App.jsx             # Main launch screen
│   ├── index.css
│   ├── main.jsx            # Main function
├── index.html
├── eslint.config.js        ## Files not to touch ##
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js

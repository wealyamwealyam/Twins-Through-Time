git clone ____<br/>
npm install<br/>
npm run dev<br/>
<br/>
<br/>
Structure<br/>
├── node_modules            # Project Dependencies<br/>
├── public                  # Public Images used throughout the site<br/>
│   ├── sleuth.jpeg<br/>
│   ├── sleuth2.png<br/>
│   └── vite.svg<br/>
├── src                     # Source Code<br/>
│   ├── assets              # Browser Images<br/>
│   │   └── react.svg<br/>
│   ├── components          # React Components<br/>
│   │   ├── Footer.jsx<br/>
│   │   └── Navbar.jsx<br/>
│   └── pages               # Web Pages (Links)<br/>
│       ├── History.jsx<br/>
│       ├── Home.jsx<br/>
│       ├── Profile.jsx<br/>
│       └── Upload.jsx<br/>
│   ├── App.css             # Replaced by tailwind<br/>
│   ├── App.jsx             # Main launch screen<br/>
│   ├── index.css<br/>
│   ├── main.jsx            # Main function<br/>
├── index.html<br/>
├── eslint.config.js        ## Files not to touch ##<br/>
├── package-lock.json<br/>
├── package.json<br/>
├── postcss.config.js<br/>
├── tailwind.config.js<br/>
└── vite.config.js<br/>

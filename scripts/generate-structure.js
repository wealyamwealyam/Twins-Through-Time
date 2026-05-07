#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const readmePath = path.join(repoRoot, "README.md");

const excludedNames = new Set([
  ".git",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "output",
  "logs",
  "__pycache__",
]);

const excludedFiles = new Set([
  ".env",
  "file_structure.txt",
  "files.txt",
  "llm_output.json",
  "package-lock.json",
  "structure.txt",
]);

const collator = new Intl.Collator("en");

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function isDirectory(relativePath) {
  return exists(relativePath) && fs.statSync(path.join(repoRoot, relativePath)).isDirectory();
}

function makeEntry(name, comment, children) {
  return {
    name,
    comment,
    children: children ? children.filter(Boolean) : undefined,
  };
}

function file(relativePath, comment) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return null;
  }

  return makeEntry(path.basename(relativePath), comment);
}

function directory(relativePath, comment, children) {
  if (!isDirectory(relativePath)) {
    return null;
  }

  return makeEntry(`${path.basename(relativePath)}/`, comment, children);
}

function filesFrom(relativePath, options = {}) {
  if (!isDirectory(relativePath)) {
    return [];
  }

  const extensions = options.extensions || null;
  const comments = options.comments || {};

  return fs
    .readdirSync(path.join(repoRoot, relativePath), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => !excludedFiles.has(entry.name))
    .filter((entry) => !extensions || extensions.includes(path.extname(entry.name)))
    .sort((a, b) => collator.compare(a.name, b.name))
    .map((entry) => file(path.join(relativePath, entry.name), comments[entry.name]));
}

function rootFile(relativePath, comment) {
  const name = path.basename(relativePath);

  if (excludedFiles.has(name) || excludedNames.has(name)) {
    return null;
  }

  return file(relativePath, comment);
}

function patternIfFiles(relativePath, pattern, label, comment) {
  if (!isDirectory(relativePath)) {
    return null;
  }

  const hasMatch = fs
    .readdirSync(path.join(repoRoot, relativePath), { withFileTypes: true })
    .some((entry) => entry.isFile() && pattern.test(entry.name));

  return hasMatch ? makeEntry(label, comment) : null;
}

function renderLine(prefix, branch, entry) {
  const label = `${prefix}${branch}${entry.name}`;
  const paddedLabel = entry.comment && label.length < 42 ? label.padEnd(42, " ") : label;
  return entry.comment ? `${paddedLabel} # ${entry.comment}` : label;
}

function renderTree(entries) {
  const lines = [`${path.basename(repoRoot)}/`];

  function visit(nodes, prefix) {
    nodes.forEach((entry, index) => {
      const isLast = index === nodes.length - 1;
      const branch = isLast ? "`-- " : "|-- ";
      lines.push(renderLine(prefix, branch, entry));

      if (entry.children && entry.children.length > 0) {
        visit(entry.children, `${prefix}${isLast ? "    " : "|   "}`);
      }
    });
  }

  visit(entries.filter(Boolean), "");
  return lines.join("\n");
}

function buildStructureEntries() {
  return [
    directory(".github", "Repository automation", [
      directory(".github/workflows", "GitHub Actions CI/deploy workflows", filesFrom(".github/workflows", {
        extensions: [".yml", ".yaml"],
      })),
    ]),
    directory("frontend", "React + Vite frontend application", [
      directory("frontend/public", "Static assets served by Vite", [
        directory("frontend/public/DemoPictures", "Demo images", filesFrom("frontend/public/DemoPictures")),
        ...filesFrom("frontend/public"),
      ]),
      directory("frontend/src", "React source code", [
        directory("frontend/src/assets", "Browser images and bundled assets", filesFrom("frontend/src/assets")),
        directory("frontend/src/components", "Reusable React components", filesFrom("frontend/src/components", {
          extensions: [".jsx", ".js"],
        })),
        directory("frontend/src/hooks", "Reusable React hooks", filesFrom("frontend/src/hooks", {
          extensions: [".jsx", ".js"],
        })),
        directory("frontend/src/pages", "Web pages and route views", filesFrom("frontend/src/pages", {
          extensions: [".jsx", ".js"],
        })),
        directory("frontend/src/services", "Frontend API/service wrappers", filesFrom("frontend/src/services", {
          extensions: [".js", ".jsx"],
        })),
        directory("frontend/src/utils", "Frontend helper utilities", filesFrom("frontend/src/utils", {
          extensions: [".js", ".jsx"],
        })),
        file("frontend/src/App.jsx", "App shell and frontend routes"),
        file("frontend/src/main.jsx", "React entry point"),
        file("frontend/src/supabaseClient.js", "Supabase client setup"),
        file("frontend/src/App.css"),
        file("frontend/src/index.css"),
      ]),
      file("frontend/index.html", "Vite HTML entry"),
      file("frontend/package.json", "Frontend scripts and dependencies"),
      file("frontend/vite.config.js", "Vite configuration"),
      file("frontend/tailwind.config.js", "Tailwind configuration"),
      file("frontend/postcss.config.js", "PostCSS configuration"),
      file("frontend/eslint.config.js", "ESLint configuration"),
    ]),
    directory("backend", "Node.js + Express backend API", [
      directory("backend/src", "Express API source code", [
        directory("backend/src/config", "Configuration files", filesFrom("backend/src/config", {
          extensions: [".js"],
        })),
        directory("backend/src/controllers", "Request handlers", filesFrom("backend/src/controllers", {
          extensions: [".js"],
        })),
        directory("backend/src/middleware", "Custom Express middleware", filesFrom("backend/src/middleware", {
          extensions: [".js"],
        })),
        directory("backend/src/models", "Database models", filesFrom("backend/src/models", {
          extensions: [".js"],
        })),
        directory("backend/src/routes", "API route definitions", filesFrom("backend/src/routes", {
          extensions: [".js"],
        })),
        directory("backend/src/utils", "Backend helper utilities", filesFrom("backend/src/utils", {
          extensions: [".js"],
        })),
        file("backend/src/index.js", "API app/bootstrap wiring"),
        file("backend/src/server.js", "Server entry point"),
      ]),
      directory("backend/docs", "Backend database/schema docs", filesFrom("backend/docs")),
      patternIfFiles("backend", /^test-.*\.mjs$/, "test-*.mjs", "Backend API/model test scripts"),
      file("backend/package.json", "Backend scripts and dependencies"),
      file("backend/README.md", "Backend-specific setup notes"),
    ]),
    directory("docs", "Project documentation", filesFrom("docs")),
    directory("llm", "LLM matching utilities", filesFrom("llm")),
    directory("scraping", "Historical image scraping tools", filesFrom("scraping", {
      extensions: [".py", ".js"],
    })),
    directory("scripts", "Maintenance scripts", [
      file("scripts/generate-structure.js", "Regenerates this README section"),
    ]),
    rootFile("package.json", "Root npm scripts for the full-stack workflow"),
    rootFile("render.yaml", "Render deployment configuration"),
    rootFile("QUICKSTART.md", "Quick setup guide"),
    rootFile("README.md", "Project overview"),
  ];
}

function buildProjectStructureSection() {
  return [
    "## Project Structure",
    "",
    "```text",
    renderTree(buildStructureEntries()),
    "```",
  ].join("\n");
}

function updateReadme() {
  const readme = fs.readFileSync(readmePath, "utf8");
  const lines = readme.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^## .*Project Structure\s*$/.test(line));

  if (startIndex === -1) {
    throw new Error("Could not find the Project Structure section in README.md.");
  }

  const nextHeadingIndex = lines.findIndex((line, index) => index > startIndex && /^## /.test(line));
  const before = lines.slice(0, startIndex);
  const after = nextHeadingIndex === -1 ? [] : lines.slice(nextHeadingIndex);
  const nextReadme = [...before, buildProjectStructureSection(), "", ...after].join("\n");

  fs.writeFileSync(readmePath, nextReadme);
}

updateReadme();

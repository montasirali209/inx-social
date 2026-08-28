const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.0 provides a typed Vite and Tailwind v4 application foundation', () => {
  const pkg = JSON.parse(read('frontend/package.json'));
  const css = read('frontend/src/index.css');
  const vite = read('frontend/vite.config.ts');
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.dependencies['@tanstack/react-query']);
  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme/);
  assert.match(vite, /base: '\/app\/'/);
  assert.match(vite, /tailwindcss\(\)/);
});

test('Phase 13.0 serves the React SPA without intercepting API routes', () => {
  const app = read('src/app.js');
  const apiIndex = app.indexOf("app.use('/api/auth'");
  const fallbackIndex = app.indexOf("app.get('/app/*'");
  assert.match(app, /app\.use\('\/app', express\.static\(reactAppRoot/);
  assert.match(app, /app\.get\(\/\^\\\/app\$\//);
  assert.ok(apiIndex > -1 && fallbackIndex > apiIndex);
  assert.match(app, /React application build is not available/);
});

test('Phase 13.0 keeps the legacy Studio available during phased migration', () => {
  const app = read('src/app.js');
  const shell = read('frontend/src/components/layout/AppShell.tsx');
  assert.match(app, /app\.use\('\/studio', express\.static/);
  assert.match(shell, /href="\/studio\/"/);
});

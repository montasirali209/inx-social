const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');

test('Phase 13.0.1 installs React dependencies before the backend check invokes them', () => {
  const workflow = read('.github/workflows/ci.yml');
  const installIndex = workflow.indexOf('npm --prefix frontend ci');
  const checkIndex = workflow.indexOf('npm run check', installIndex);
  assert.ok(installIndex > -1);
  assert.ok(checkIndex > installIndex);
});

test('Phase 13.0.1 uses a deterministic Vitest worker on Windows and CI', () => {
  const config = read('inx-social-cloud-backend/frontend/vite.config.ts');
  assert.match(config, /pool: 'threads'/);
  assert.match(config, /fileParallelism: false/);
});

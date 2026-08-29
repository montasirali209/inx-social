const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Phase 13.0.2 declares the image compositor as a production dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.dependencies.sharp, '0.35.4');
  assert.equal(lock.packages[''].dependencies.sharp, '0.35.4');
  assert.equal(lock.packages['node_modules/sharp'].version, '0.35.4');
});

test('the declared compositor can be loaded after a clean dependency install', () => {
  const sharp = require('sharp');
  assert.equal(typeof sharp, 'function');
});

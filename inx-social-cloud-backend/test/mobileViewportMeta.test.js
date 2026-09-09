const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('public landing retains mobile viewport metadata', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/landing.html'), 'utf8');
  assert.match(html, /name="viewport" content="width=device-width,initial-scale=1"/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('guest auth gate renders only a session check while authentication is unresolved', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/auth/RequireAuth.tsx'), 'utf8');
  assert.match(source, /if \(state !== 'authenticated'\)/);
  assert.match(source, /Checking your secure INXSocial session/);
});

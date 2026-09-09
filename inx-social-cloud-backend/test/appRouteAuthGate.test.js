const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('/app workspace renders only after the stored token passes /api/auth/me', () => {
  const gate = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/auth/RequireAuth.tsx'), 'utf8');
  const shell = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/layout/AppShell.tsx'), 'utf8');
  assert.match(gate, /getStoredAuthToken\(\)/);
  assert.match(gate, /\/api\/auth\/me/);
  assert.match(gate, /window\.location\.replace\(loginUrl\(\)\)/);
  assert.match(shell, /<RequireAuth>/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app shell uses compact base padding on mobile', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/layout/AppShell.tsx'), 'utf8');
  assert.match(source, /p-2\.5 sm:p-4 lg:p-5 xl:p-6/);
  assert.match(source, /max-w-full overflow-x-clip/);
});

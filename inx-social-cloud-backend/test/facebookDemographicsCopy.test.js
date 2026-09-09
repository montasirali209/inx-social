const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Facebook demographics UI explains snapshot fallback instead of presenting missing Instagram as a broken Facebook connection', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/analytics/AudienceCards.tsx'), 'utf8');
  assert.match(source, /Meta no longer exposes native Facebook Page age and gender/);
  assert.match(source, /Add Business Suite snapshot/);
  assert.match(source, /separately labelled source/);
});

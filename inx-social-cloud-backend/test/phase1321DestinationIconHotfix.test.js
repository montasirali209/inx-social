const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('destination platform badge uses an explicit non-overlapping size', () => {
  const mark = read('frontend/src/components/bulk-scheduler/PlatformMark.tsx');
  const card = read('frontend/src/components/bulk-scheduler/DestinationCard.tsx');
  assert.match(mark, /xs: 'size-5 text-\[8px\]'/);
  assert.match(mark, /sizeStyles\[size\]/);
  assert.match(card, /size="xs"/);
  assert.doesNotMatch(card, /className="[^"]*size-5[^"]*" platform=/);
});

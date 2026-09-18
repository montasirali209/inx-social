const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('AI Content Studio uses a stable hero skeleton while access loads', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const primitives = read('frontend/src/components/ai-content-studio/AIStudioPrimitives.tsx');

  assert.match(page, /AIStudioHeroSkeleton/);
  assert.doesNotMatch(page, /The creation workspace is ready immediately/);
  assert.match(primitives, /export function AIStudioHeroSkeleton/);
  assert.match(primitives, /Turn ideas into/);
  assert.match(primitives, /Loading AI Content Studio access/);
});

test('AI Studio plan card derives labels and allowance from live access', () => {
  const primitives = read('frontend/src/components/ai-content-studio/AIStudioPrimitives.tsx');
  const types = read('frontend/src/types/ai-content-studio.ts');
  const credits = read('src/services/aiCreditService.js');

  assert.match(primitives, /Administrator Access/);
  assert.match(primitives, /planLabels\[access\.plan\]/);
  assert.match(primitives, /access\.creditsLimit\.toLocaleString\(\)/);
  assert.doesNotMatch(primitives, />Plus Plan</);
  assert.doesNotMatch(primitives, /500 monthly AI Studio credits/);
  assert.match(types, /administrator\?: boolean/);
  assert.match(credits, /administrator: Boolean\(entitlement\.administrator\)/);
});

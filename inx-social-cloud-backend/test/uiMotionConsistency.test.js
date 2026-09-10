const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Analytics cards use restrained selection motion without cursor tilt or glare', () => {
  const primitives = read('frontend/src/components/analytics/AnalyticsPrimitives.tsx');
  const motion = read('frontend/src/components/analytics/analytics-motion.css');
  const selector = read('frontend/src/components/analytics/AnalyticsAccountSelector.tsx');

  assert.doesNotMatch(primitives, /onPointerMove|onPointerLeave|--analytics-rx|--analytics-ry|--analytics-mx|--analytics-my/);
  assert.doesNotMatch(motion, /perspective\(|rotateX\(|rotateY\(|translateZ\(|translate3d\(|analytics-ambient-drift|var\(--analytics-m/);
  assert.match(motion, /\.analytics-fluid-card:hover\s*\{[\s\S]*?transform:\s*scale\(1\.006\)/);
  assert.match(motion, /\.analytics-stat-card:hover\s*\{[\s\S]*?transform:\s*scale\(1\.01\)/);
  assert.doesNotMatch(selector, /hover:-translate-y|emerald-950|border-emerald-300|text-emerald-300/);
});

test('Billing surfaces communicate depth without hover lift', () => {
  const primitives = read('frontend/src/components/billing/BillingPrimitives.tsx');
  const depth = read('frontend/src/components/billing/billing-depth.css');

  assert.match(primitives, /billing-depth-card/);
  assert.match(primitives, /billing-depth-button/);
  assert.doesNotMatch(primitives, /hover:-translate-y/);
  assert.match(depth, /\.billing-depth-card:hover\s*\{[\s\S]*?transform:\s*scale\(1\.0035\)/);
  assert.match(depth, /\.billing-depth-card article:hover\s*\{[\s\S]*?transform:\s*scale\(1\.008\)/);
  assert.match(depth, /inset 0 1px 0/);
  assert.doesNotMatch(depth, /translateY|translate3d|rotateX|rotateY|perspective\(/);
});

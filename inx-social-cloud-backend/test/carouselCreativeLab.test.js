const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('carousel generation uses the animated creative lab in the preview area', () => {
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  const lab = read('frontend/src/components/ai-content-studio/CarouselCreativeLab.tsx');
  assert.match(modal, /generating && <CarouselCreativeLab slides=\{slides\}/);
  assert.match(modal, /!generating && asset && selectedSlide/);
  assert.match(lab, /Your carousel is taking shape/);
  assert.match(lab, /Reworking your creative direction/);
  assert.match(lab, /inxLabSketch/);
  assert.match(lab, /prefers-reduced-motion/);
});

test('Continue to Posts is single-flight and exposes progress feedback', () => {
  const modal = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  assert.match(modal, /const \[continuing, setContinuing\] = useState\(false\)/);
  assert.match(modal, /if \(!asset \|\| continuing \|\| generating\) return/);
  assert.match(modal, /await onContinue\(/);
  assert.match(modal, /Preparing Posts…/);
  assert.match(modal, /You only need to click once/);
});

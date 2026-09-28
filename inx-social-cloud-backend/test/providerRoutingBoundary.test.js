const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcRoot = path.join(__dirname, '..', 'src');
const allowedRunwareConsumers = new Set([
  'controllers/aiContentStudioController.js',
  'services/aiContentStudioService.js',
  'services/ugcProviderAdapters.js',
  'services/ugcStudioService.js',
  'services/videoStudioService.js'
]);

function javascriptFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return javascriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

test('Runware is callable only from AI Content Studio, UGC Studio and Video Studio', () => {
  const consumers = javascriptFiles(srcRoot)
    .filter(file => /require\(['"][^'"]*runwareService['"]\)/.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(srcRoot, file).replaceAll(path.sep, '/'))
    .sort();

  assert.deepEqual(consumers, [...allowedRunwareConsumers].sort());
});

test('SEO featured images remain locked to the OpenAI image endpoint', () => {
  const service = fs.readFileSync(path.join(srcRoot, 'services', 'growthContentService.js'), 'utf8');
  assert.match(service, /https:\/\/api\.openai\.com\/v1\/images\/generations/);
  assert.match(service, /imageProvider: 'openai'/);
  assert.doesNotMatch(service, /runwareService|api\.runware\.ai/);
});

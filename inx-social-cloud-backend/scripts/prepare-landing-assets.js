const fs = require('fs');
const path = require('path');

const assetsRoot = path.join(__dirname, '..', 'public', 'assets');
const partsRoot = path.join(assetsRoot, 'dashboard-final.parts');
const outputPath = path.join(assetsRoot, 'inxsocial-dashboard-final.avif');
const partNames = ['part1.b64', 'part2.b64', 'part3.b64', 'part4.b64'];

const encoded = partNames
  .map(name => fs.readFileSync(path.join(partsRoot, name), 'utf8').trim())
  .join('');

if (encoded.length !== 63304) {
  throw new Error(`Unexpected dashboard asset payload length: ${encoded.length}`);
}

const image = Buffer.from(encoded, 'base64');
if (image.length !== 47478 || image.toString('ascii', 4, 12) !== 'ftypavif') {
  throw new Error('Dashboard asset integrity check failed');
}

fs.writeFileSync(outputPath, image);
console.log(`Prepared landing dashboard asset (${image.length} bytes)`);

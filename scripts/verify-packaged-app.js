const fs = require('fs');
const path = require('path');
const {
  getCurrentFuseWire,
  FuseV1Options
} = require('@electron/fuses');

const ENABLED = '1'.charCodeAt(0);
const DISABLED = '0'.charCodeAt(0);

async function main() {
  const executable = path.resolve(process.argv[2] || path.join('release', 'win-unpacked', 'INX Social.exe'));
  const resources = path.join(path.dirname(executable), 'resources');
  const asarPath = path.join(resources, 'app.asar');
  const unpackedAppPath = path.join(resources, 'app');

  if (!fs.existsSync(executable)) throw new Error(`Packaged executable not found: ${executable}`);
  if (!fs.existsSync(asarPath)) throw new Error('app.asar was not created.');
  if (fs.existsSync(unpackedAppPath)) throw new Error('An unpacked application directory was found beside app.asar.');

  const fuses = await getCurrentFuseWire(executable);
  const expected = new Map([
    [FuseV1Options.RunAsNode, DISABLED],
    [FuseV1Options.EnableCookieEncryption, ENABLED],
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable, DISABLED],
    [FuseV1Options.EnableNodeCliInspectArguments, DISABLED],
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, ENABLED],
    [FuseV1Options.OnlyLoadAppFromAsar, ENABLED],
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, DISABLED]
  ]);

  const failures = [];
  for (const [fuse, state] of expected) {
    if (fuses[fuse] !== state) {
      failures.push(`${FuseV1Options[fuse]} expected ${String.fromCharCode(state)} but found ${String.fromCharCode(fuses[fuse] || 63)}`);
    }
  }
  if (failures.length) throw new Error(`Electron fuse verification failed:\n- ${failures.join('\n- ')}`);

  console.log('Packaged ASAR layout and Electron fuses are valid.');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});

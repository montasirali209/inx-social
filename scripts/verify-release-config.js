const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mainSource = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(root, 'src/main/preload.js'), 'utf8');
const facebookClientSource = fs.readFileSync(path.join(root, 'src/main/services/facebookClient.js'), 'utf8');
const rendererHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8');
const connectHandlerStart = mainSource.indexOf("handleTrustedIpc('workspace:connect-facebook'");
const connectHandlerEnd = mainSource.indexOf("handleTrustedIpc('workspace:discover-account'", connectHandlerStart);
const connectHandlerSource = connectHandlerStart >= 0 && connectHandlerEnd > connectHandlerStart
  ? mainSource.slice(connectHandlerStart, connectHandlerEnd)
  : '';

const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(pkg.private === true, 'package.json must remain private.');
expect(pkg.license === 'UNLICENSED', 'package.json must remain UNLICENSED.');
expect(pkg.build?.asar === true, 'Electron ASAR packaging must be enabled.');

const requiredFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true
};
for (const [name, expected] of Object.entries(requiredFuses)) {
  expect(pkg.build?.electronFuses?.[name] === expected, `Electron fuse ${name} must be ${expected}.`);
}

const iconPath = path.join(root, 'build/icon.ico');
expect(fs.existsSync(iconPath), 'build/icon.ico is required.');
if (fs.existsSync(iconPath)) {
  const header = fs.readFileSync(iconPath).subarray(0, 4).toString('hex');
  expect(header === '00000100', 'build/icon.ico is not a valid Windows icon resource.');
}

expect(/sandbox:\s*true/.test(mainSource), 'Renderer sandboxing must remain enabled.');
expect(/devTools:\s*!app\.isPackaged/.test(mainSource), 'Production DevTools must remain disabled.');
expect(/title:\s*'Connect Facebook Page'[\s\S]*?devTools:\s*false/.test(mainSource), 'Facebook OAuth DevTools must remain disabled.');
expect(/function handleTrustedIpc\(/.test(mainSource), 'Trusted IPC sender validation is required.');
expect(/webUtils\.getPathForFile/.test(preloadSource), 'Sandbox-safe drag-and-drop file paths are required.');
expect(/Content-Security-Policy/.test(rendererHtml), 'Renderer Content Security Policy is required.');
expect(!/\bonclick\s*=/.test(rendererHtml), 'Inline renderer click handlers are not allowed.');
expect(!/<[^>]+\bonclick\s*=/i.test(rendererSource), 'Generated inline renderer click handlers are not allowed.');
expect(!/\bfile\.path\b/.test(rendererSource), 'Deprecated unsandboxed file.path access is not allowed.');
expect(!/pageAccessToken|settingToken/.test(rendererSource), 'Facebook Page credentials must never enter the renderer.');
expect(!/Sync saved Facebook Page|reusedSavedConnection|Reusing verified Facebook Page connection/.test(`${mainSource}\n${rendererSource}`), 'Connect Facebook Page must never silently reuse an existing Page connection.');
expect(Boolean(connectHandlerSource), 'The trusted Connect Facebook Page handler is required.');
expect(/const localResult = await connectFacebookPageAuto\(\);/.test(connectHandlerSource), 'Connect Facebook Page must always start the Facebook OAuth flow.');
expect(!/testConnection\(\)/.test(connectHandlerSource), 'Connect Facebook Page must not test and reuse the currently active Page.');
expect(/id="btnAddMetaAccount"[^>]*>\+ Connect Facebook Page</.test(rendererHtml), 'Pages must show a clear Add Facebook Page action.');
expect(!/data-view="workspace"|id="workspace"/.test(rendererHtml), 'The duplicate Workspace menu and view must remain removed.');
expect(/revokeWorkspacePage\(active\.id\)[\s\S]*?return;[\s\S]*?disconnectFacebookPage\(\)/.test(rendererSource), 'Disconnect active Page must stop after cloud revocation instead of clearing all remaining Pages.');
expect(/Active Page: \$\{name\} • credentials protected/.test(rendererSource), 'Settings must describe the selected Active Page instead of implying only one Page can connect.');
expect(/Facebook returned a different Page than the selected Active Page/.test(mainSource), 'Test Active Page must verify the selected Facebook Page ID.');
expect(!/fields:\s*['"][^'"]*access_token/.test(facebookClientSource), 'Facebook connection tests must not request a Page token in the response fields.');
expect(!/Plan, upload, and schedule Facebook Reels|A professional desktop scheduler for Facebook Reels/.test(rendererHtml), 'Dashboard hero copy must describe INX Social as a broader content scheduler.');
expect(/<small>completed<\/small>/.test(rendererHtml), 'The dashboard completion ring must not be labelled as live upload progress.');
expect(/completed or scheduled out of/.test(rendererSource), 'The dashboard completion percentage must explain its calculation.');

if (errors.length) {
  console.error('Release security configuration failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Release security configuration is valid.');

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const FRONTEND_ROOT = path.resolve(__dirname, '../../frontend');
const FRONTEND_NODE_MODULES = path.join(FRONTEND_ROOT, 'node_modules');
const VITE_CLI = path.join(FRONTEND_NODE_MODULES, 'vite', 'bin', 'vite.js');
const MAX_BUILD_LOG = 12 * 1024 * 1024;

function publicError(message, status = 400, code = 'UI_STUDIO_PREVIEW_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function packageRoot(specifier) {
  const value = String(specifier || '');
  if (value.startsWith('@')) return value.split('/').slice(0, 2).join('/');
  return value.split('/')[0];
}

function frontendAllowedPackages() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf8'));
    return new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      'next'
    ]);
  } catch (_) {
    return new Set(['react', 'react-dom', 'lucide-react', 'next']);
  }
}

const BLOCKED_SOURCE_PATTERNS = [
  { re: /\b(?:child_process|worker_threads|cluster|dgram|net|tls)\b/, message: 'Node process/network APIs are not allowed in UI Studio previews.' },
  { re: /\b(?:eval|Function)\s*\(/, message: 'Dynamic code evaluation is not allowed in UI Studio previews.' },
  { re: /\bprocess\.env\b/, message: 'Environment access is not allowed in UI Studio previews.' },
  { re: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, message: 'Network calls are not allowed in UI Studio previews.' },
  { re: /<\s*(?:iframe|object|embed)\b/i, message: 'Embedded remote documents are not allowed in UI Studio previews.' },
  { re: /<script[^>]+src\s*=\s*["']https?:/i, message: 'Remote scripts are not allowed in UI Studio previews.' },
  { re: /<(?:img|video|audio|source)[^>]+src\s*=\s*["']https?:/i, message: 'Remote media is not allowed in UI Studio previews.' }
];

function validateGeneratedSources(result) {
  const files = Array.isArray(result?.files) ? result.files : [];
  if (!files.length) throw publicError('The selected generation has no implementation files.', 422, 'UI_STUDIO_PREVIEW_FILES_EMPTY');
  const allowed = frontendAllowedPackages();

  for (const file of files) {
    const source = String(file.content || '');
    for (const rule of BLOCKED_SOURCE_PATTERNS) {
      if (rule.re.test(source)) {
        throw publicError(rule.message, 422, 'UI_STUDIO_PREVIEW_SOURCE_BLOCKED');
      }
    }

    const importMatches = [
      ...source.matchAll(/\b(?:import|export)\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g),
      ...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)
    ];
    for (const match of importMatches) {
      const specifier = match[1];
      if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) continue;
      if (specifier.startsWith('node:')) {
        throw publicError('Node built-in imports are not allowed in UI Studio previews.', 422, 'UI_STUDIO_PREVIEW_IMPORT_BLOCKED');
      }
      const root = packageRoot(specifier);
      if (!allowed.has(root)) {
        throw publicError('Unsupported preview dependency "' + root + '". Regenerate without that dependency.', 422, 'UI_STUDIO_PREVIEW_DEPENDENCY_BLOCKED');
      }
      if (root === 'next' && !['next/image','next/link','next/navigation'].includes(specifier)) {
        throw publicError('UI Studio preview supports next/image, next/link and next/navigation only.', 422, 'UI_STUDIO_PREVIEW_NEXT_IMPORT_BLOCKED');
      }
    }
  }
  return true;
}

function safeGeneratedPath(value) {
  const relative = String(value || '').trim().replace(/\\/g, '/');
  if (!relative || relative.startsWith('/') || relative.includes('..')) return null;
  if (!/^[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/.test(relative)) return null;
  return relative;
}

function writeGeneratedFiles(root, result) {
  for (const file of result.files || []) {
    const relative = safeGeneratedPath(file.path);
    if (!relative) throw publicError('Generated file path is unsafe.', 422, 'UI_STUDIO_PREVIEW_PATH_UNSAFE');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw publicError('Generated file path is unsafe.', 422, 'UI_STUDIO_PREVIEW_PATH_UNSAFE');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(file.content || ''), 'utf8');
  }
}

function entryImport(entryPath, content) {
  if (/export\s+default\b/.test(content)) {
    return `import Entry from './${entryPath.replace(/\\/g, '/')}';`;
  }
  const named = content.match(/export\s+(?:function|const|class)\s+([A-Za-z_$][\w$]*)/);
  if (named) return `import { ${named[1]} as Entry } from './${entryPath.replace(/\\/g, '/')}';`;
  throw publicError('The generated entry file must export a React component.', 422, 'UI_STUDIO_PREVIEW_ENTRY_EXPORT');
}

function inferredPropNames(source) {
  const names = new Set();
  const text = String(source || '');
  for (const regex of [
    /function\s+[A-Za-z_$][\w$]*\s*\(\s*\{([^}]{0,1200})\}\s*[:)]/m,
    /(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*\(\s*\{([^}]{0,1200})\}\s*[:)]/m,
    /export\s+default\s+function\s*[A-Za-z_$]*\s*\(\s*\{([^}]{0,1200})\}\s*[:)]/m
  ]) {
    const match = text.match(regex);
    if (!match) continue;
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().split(':')[0].split('=')[0].trim().replace(/[?\s]/g, '');
      if (/^[A-Za-z_$][\w$]*$/.test(cleaned)) names.add(cleaned);
    }
  }
  return [...names].slice(0, 60);
}

function mockPropsSource(propNames, boundProps = {}) {
  const names = [...new Set([
    ...propNames,
    ...Object.keys(boundProps || {}),
    'imageSrc','videoSrc','poster','logoSrc','avatarSrc','src','href','title','subtitle','description',
    'creators','items','cards','features','stats','slides','testimonials','onSelect','onClick','activeIndex'
  ])];
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"%3E%3Crect width="100%25" height="100%25" fill="%231a4b4b"/%3E%3Ccircle cx="450" cy="620" r="190" fill="%232c7772"/%3E%3Crect x="235" y="850" width="430" height="380" rx="180" fill="%23245f5c"/%3E%3C/svg%3E';
  return `
const __placeholderImage = ${JSON.stringify(placeholder)};
const __boundProps = ${JSON.stringify(boundProps || {})};
const __item = (index) => ({
  id: String(index + 1),
  name: ['Maya','Chloe','Sofia','Emma','Lily'][index % 5],
  title: ['Creator video','Realistic creator','Short-form video','UGC style','Product demo'][index % 5],
  label: ['Creator Styles','Videos Generated','User Satisfaction','Higher Engagement'][index % 4],
  value: ['50+','1K+','98%','3x'][index % 4],
  description: 'Generated preview content',
  image: __placeholderImage,
  imageSrc: __placeholderImage,
  avatar: __placeholderImage,
  avatarSrc: __placeholderImage,
  poster: __placeholderImage,
  video: '',
  videoSrc: '',
  href: '#'
});
const __items = Array.from({ length: 8 }, (_, index) => __item(index));
const __keys = ${JSON.stringify(names)};
const __props = new Proxy(__boundProps, {
  ownKeys(target){ return [...new Set([...Reflect.ownKeys(target), ...__keys])]; },
  getOwnPropertyDescriptor(){ return { enumerable: true, configurable: true }; },
  get(target, key){
    if (Reflect.has(target, key)) return Reflect.get(target, key);
    const name = String(key);
    if (/^on[A-Z]/.test(name)) return () => {};
    if (/^(is|has|show|enabled|active)/i.test(name)) return false;
    if (/index|count|total/i.test(name)) return 0;
    if (/creators|items|cards|features|stats|slides|testimonials|models|videos|posts/i.test(name)) return __items;
    if (/image|logo|avatar|photo|poster|thumbnail/i.test(name)) return __placeholderImage;
    if (/video/i.test(name)) return '';
    if (/href|url|link/i.test(name)) return '#';
    if (/title|heading/i.test(name)) return 'Creator-style videos';
    if (/description|subtitle|copy|text/i.test(name)) return 'Responsive UI preview';
    return 'Preview';
  }
});`;
}

function escapeForStyle(value) {
  return String(value || '').replace(/<\/style/gi, '<\\/style');
}

function escapeForScript(value) {
  return String(value || '').replace(/<\/script/gi, '<\\/script');
}

function inlineDistHtml(distRoot, width, height) {
  let html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  html = html.replace(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/gi, (_match, src) => {
    const rel = src.replace(/^\.\//, '').replace(/^\//, '');
    const file = path.resolve(distRoot, rel);
    const js = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return '<script type="module">' + escapeForScript(js) + '</script>';
  });
  html = html.replace(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi, (_match, href) => {
    const rel = href.replace(/^\.\//, '').replace(/^\//, '');
    const file = path.resolve(distRoot, rel);
    const css = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return '<style>' + escapeForStyle(css) + '</style>';
  });
  const freeze = '<style>html,body{margin:0!important;width:' + width + 'px!important;min-width:' + width + 'px!important;min-height:' + height + 'px!important;background:#fff}*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}</style>';
  html = html.replace(/<head([^>]*)>/i, '<head$1>' + freeze);
  return html;
}

function directHtmlPreview(result, width, height) {
  const files = result.files || [];
  const htmlFile = files.find(file => file.path === result.entryFile && /\.html?$/i.test(file.path))
    || files.find(file => /\.html?$/i.test(file.path));
  const css = files.filter(file => /\.css$/i.test(file.path)).map(file => file.content).join('\n\n');
  const js = files.filter(file => /\.m?js$/i.test(file.path)).map(file => file.content).join('\n\n');

  let html = htmlFile?.content || '<!doctype html><html><head></head><body><main id="root"></main></body></html>';
  html = html.replace(/<link[^>]+href=["'][^"']+\.css[^"']*["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/gi, '');
  const freeze = '<style>html,body{margin:0!important;width:' + width + 'px!important;min-width:' + width + 'px!important;min-height:' + height + 'px!important;background:#fff}*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}</style>';
  html = html.replace(/<head([^>]*)>/i, '<head$1>' + freeze + (css ? '<style>' + escapeForStyle(css) + '</style>' : ''));
  html = html.replace(/<\/body>/i, (js ? '<script>' + escapeForScript(js) + '</script>' : '') + '</body>');
  return html;
}

function runViteBuild(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VITE_CLI, ...args], {
      cwd: options.cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const append = (current, chunk) => (current + String(chunk)).slice(-MAX_BUILD_LOG);
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(publicError('Preview build timed out.', 504, 'UI_STUDIO_PREVIEW_BUILD_TIMEOUT'));
    }, Math.max(10000, Number(options.timeoutMs || 90000)));
    child.once('error', error => {
      clearTimeout(timeout);
      reject(publicError('Preview build failed to start: ' + String(error.message || error).slice(0, 400), 500, 'UI_STUDIO_PREVIEW_BUILD_START_FAILED'));
    });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code === 0) return resolve({ stdout, stderr });
      const detail = String(stderr || stdout || 'Unknown Vite build error').replace(/\s+/g, ' ').slice(-1600);
      reject(publicError('Generated code did not compile. ' + detail, 422, 'UI_STUDIO_PREVIEW_BUILD_FAILED'));
    });
  });
}

async function buildReactPreview(result, project, width, height, boundProps = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inx-ui-preview-'));
  try {
    validateGeneratedSources(result);
    writeGeneratedFiles(tempRoot, result);

    const linkTarget = path.join(tempRoot, 'node_modules');
    try { fs.symlinkSync(FRONTEND_NODE_MODULES, linkTarget, 'dir'); } catch (_) {
      if (!fs.existsSync(linkTarget)) throw publicError('Preview dependencies are unavailable on this runtime.', 503, 'UI_STUDIO_PREVIEW_RUNTIME_MISSING');
    }

    const entryPath = safeGeneratedPath(result.entryFile);
    const entryFile = entryPath ? path.resolve(tempRoot, entryPath) : null;
    if (!entryFile || !entryFile.startsWith(tempRoot + path.sep) || !fs.existsSync(entryFile)) {
      throw publicError('The generated entry file is missing.', 422, 'UI_STUDIO_PREVIEW_ENTRY_MISSING');
    }
    const entryContent = fs.readFileSync(entryFile, 'utf8');
    const importLine = entryImport(entryPath, entryContent);
    const props = mockPropsSource(inferredPropNames(entryContent), boundProps);

    const previewCss = project.styling === 'TAILWIND'
      ? '@import "tailwindcss";\nhtml,body,#root{margin:0;width:100%;min-height:100%;}body{overflow:hidden;background:#fff}'
      : 'html,body,#root{margin:0;width:100%;min-height:100%;}body{overflow:hidden;background:#fff}';
    fs.writeFileSync(path.join(tempRoot, '__ui_studio_preview.css'), previewCss, 'utf8');
    fs.writeFileSync(path.join(tempRoot, '__ui_studio_main.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
${importLine}
import './__ui_studio_preview.css';
${props}
const root = document.getElementById('root');
if (!root) throw new Error('Preview root is missing');
createRoot(root).render(React.createElement(Entry, __props));
`, 'utf8');

    const stubDir = path.join(tempRoot, '__ui_studio_stubs');
    fs.mkdirSync(stubDir, { recursive: true });
    fs.writeFileSync(path.join(stubDir, 'next-image.tsx'), `
import React from 'react';
export default function Image(props:any){
  const { fill, priority, loader, quality, sizes, ...rest } = props || {};
  return <img {...rest} alt={rest.alt || ''} style={fill ? {position:'absolute',inset:0,width:'100%',height:'100%',objectFit:rest.style?.objectFit || 'cover',...(rest.style||{})} : rest.style} />;
}
`, 'utf8');
    fs.writeFileSync(path.join(stubDir, 'next-link.tsx'), `
import React from 'react';
export default function Link({ href='#', children, ...rest }:any){ return <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>; }
`, 'utf8');
    fs.writeFileSync(path.join(stubDir, 'next-navigation.ts'), `
export const useRouter = () => ({ push(){}, replace(){}, back(){}, forward(){}, refresh(){}, prefetch(){} });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
`, 'utf8');

    fs.writeFileSync(path.join(tempRoot, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI Studio Preview</title></head><body><div id="root"></div><script type="module" src="/__ui_studio_main.tsx"></script></body></html>', 'utf8');

    const useTailwind = project.styling === 'TAILWIND';
    const config = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
${useTailwind ? "import tailwindcss from '@tailwindcss/vite';" : ''}
export default defineConfig({
  root: ${JSON.stringify(tempRoot)},
  base: './',
  logLevel: 'silent',
  plugins: [react()${useTailwind ? ', tailwindcss()' : ''}],
  resolve: {
    alias: {
      'next/image': ${JSON.stringify(path.join(stubDir, 'next-image.tsx'))},
      'next/link': ${JSON.stringify(path.join(stubDir, 'next-link.tsx'))},
      'next/navigation': ${JSON.stringify(path.join(stubDir, 'next-navigation.ts'))}
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 16000000,
    sourcemap: false,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
`;
    const configPath = path.join(tempRoot, 'vite.config.mjs');
    fs.writeFileSync(configPath, config, 'utf8');

    await runViteBuild(['build', '--config', configPath], { cwd: tempRoot, timeoutMs: 90000 });
    return inlineDistHtml(path.join(tempRoot, 'dist'), width, height);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function buildPreviewHtml(result, project, width, height, boundProps = {}) {
  validateGeneratedSources(result);
  if (project.framework === 'HTML_CSS') return directHtmlPreview(result, width, height);
  return buildReactPreview(result, project, width, height, boundProps);
}

async function compileGeneration(result, project) {
  const width = 1280;
  const height = 800;
  const html = await buildPreviewHtml(result, project, width, height, {});
  return { ok: true, htmlBytes: Buffer.byteLength(html, 'utf8') };
}

module.exports = {
  FRONTEND_ROOT,
  FRONTEND_NODE_MODULES,
  VITE_CLI,
  validateGeneratedSources,
  buildPreviewHtml,
  compileGeneration
};

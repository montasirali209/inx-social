'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const axios = require('axios');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const env = require('../config/env');
const objectStorage = require('./mediaObjectStorageService');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const uiStudioCodegen = require('./uiStudioCodegenService');
const webResearch = require('./webResearchService');

const VISUAL_VERSION = 'ui-visual-v1';
const MAX_CAPTURE_BYTES = 30 * 1024 * 1024;
const MAX_RENDER_PIXELS = 16_000_000;
const COMPARE_MAX_DIMENSION = 1600;
const FRONTEND_ROOT = path.resolve(__dirname, '../../frontend');
const FRONTEND_NODE_MODULES = path.join(FRONTEND_ROOT, 'node_modules');
const VITE_CLI = path.join(FRONTEND_NODE_MODULES, 'vite', 'bin', 'vite.js');

function publicError(message, status = 400, code = 'UI_STUDIO_VISUAL_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function safeParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

function parseJsonObject(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const clean = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function ready() {
  return Boolean(
    env.uiStudioVisual?.apiKey
    && env.uiStudioVisual?.baseUrl
    && env.uiStudioVisual?.model
    && fs.existsSync(VITE_CLI)
    && fs.existsSync(FRONTEND_NODE_MODULES)
  );
}

function rendererStatus() {
  return {
    ready: fs.existsSync(VITE_CLI) && fs.existsSync(FRONTEND_NODE_MODULES),
    visualAiConfigured: Boolean(env.uiStudioVisual?.apiKey && env.uiStudioVisual?.baseUrl && env.uiStudioVisual?.model),
    targetScore: Number(env.uiStudioVisual?.targetScore || 90),
    maxRepairPasses: Number(env.uiStudioVisual?.maxRepairPasses || 3),
    version: VISUAL_VERSION
  };
}

function fitViewport(widthValue, heightValue) {
  const width = Math.max(1, Math.round(Number(widthValue || 1)));
  const height = Math.max(1, Math.round(Number(heightValue || 1)));
  const pixels = width * height;
  if (pixels <= MAX_RENDER_PIXELS) return { width, height, scale: 1 };
  const scale = Math.sqrt(MAX_RENDER_PIXELS / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
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
  { re: /\b(?:child_process|worker_threads|cluster|dgram|net|tls)\b/, message: 'Node process/network APIs are not allowed in visual previews.' },
  { re: /\b(?:eval|Function)\s*\(/, message: 'Dynamic code evaluation is not allowed in visual previews.' },
  { re: /\bprocess\.env\b/, message: 'Environment access is not allowed in visual previews.' },
  { re: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, message: 'Network calls are not allowed in visual previews.' },
  { re: /<script[^>]+src\s*=\s*["']https?:/i, message: 'Remote scripts are not allowed in visual previews.' }
];

function validateGeneratedSources(result) {
  const files = Array.isArray(result?.files) ? result.files : [];
  if (!files.length) throw publicError('The selected generation has no implementation files.', 422, 'UI_STUDIO_VISUAL_FILES_EMPTY');
  const allowed = frontendAllowedPackages();

  for (const file of files) {
    const content = String(file.content || '');
    for (const rule of BLOCKED_SOURCE_PATTERNS) {
      if (rule.re.test(content)) {
        throw publicError(rule.message + ' Regenerate the Phase 3 code before rendering.', 422, 'UI_STUDIO_VISUAL_SOURCE_BLOCKED');
      }
    }
    const importMatches = [
      ...content.matchAll(/\b(?:import|export)\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g),
      ...content.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)
    ];
    for (const match of importMatches) {
      const specifier = match[1];
      if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) continue;
      if (specifier.startsWith('node:')) {
        throw publicError('Node built-in imports are not allowed in visual previews.', 422, 'UI_STUDIO_VISUAL_IMPORT_BLOCKED');
      }
      const root = packageRoot(specifier);
      if (!allowed.has(root)) {
        throw publicError('Preview build blocked unsupported dependency "' + root + '". Regenerate without external packages.', 422, 'UI_STUDIO_VISUAL_DEPENDENCY_BLOCKED');
      }
      if (root === 'next' && !['next/image','next/link','next/navigation'].includes(specifier)) {
        throw publicError('Preview currently supports next/image, next/link and next/navigation only.', 422, 'UI_STUDIO_VISUAL_NEXT_IMPORT_BLOCKED');
      }
    }
  }
  return true;
}

function escapeForScript(value) {
  return String(value || '').replace(/<\/script/gi, '<\\/script');
}

function captureRuntime(width, height) {
  return `
<script>
(() => {
  const WIDTH = ${Number(width)};
  const HEIGHT = ${Number(height)};
  const post = payload => {
    try { parent.postMessage(payload, '*'); } catch (_) {}
  };
  window.addEventListener('error', event => {
    post({ type: 'ui-studio-preview-error', message: String(event.message || 'Preview runtime error') });
  });
  window.addEventListener('unhandledrejection', event => {
    post({ type: 'ui-studio-preview-error', message: String(event.reason?.message || event.reason || 'Preview promise error') });
  });

  function copyComputed(source, target) {
    const computed = getComputedStyle(source);
    for (let i = 0; i < computed.length; i += 1) {
      const key = computed[i];
      try { target.style.setProperty(key, computed.getPropertyValue(key), computed.getPropertyPriority(key)); } catch (_) {}
    }
    if (source instanceof HTMLCanvasElement && target instanceof HTMLCanvasElement) {
      try {
        const img = document.createElement('img');
        img.src = source.toDataURL('image/png');
        img.style.cssText = target.style.cssText;
        target.replaceWith(img);
      } catch (_) {}
    }
    if (source instanceof HTMLVideoElement && target instanceof HTMLVideoElement) {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = target.style.cssText;
      placeholder.style.background = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? computed.backgroundColor
        : '#111827';
      placeholder.setAttribute('data-ui-studio-video-placeholder', 'true');
      target.replaceWith(placeholder);
    }
  }

  async function capture() {
    try {
      if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 650));

      const sourceRoot = document.querySelector('#root') || document.body;
      const clone = sourceRoot.cloneNode(true);
      const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
      const cloneNodes = [clone, ...clone.querySelectorAll('*')];
      for (let i = 0; i < Math.min(sourceNodes.length, cloneNodes.length); i += 1) {
        copyComputed(sourceNodes[i], cloneNodes[i]);
      }

      clone.style.margin = '0';
      clone.style.width = WIDTH + 'px';
      clone.style.minHeight = HEIGHT + 'px';
      clone.style.boxSizing = 'border-box';
      const serializer = new XMLSerializer();
      const xhtml = serializer.serializeToString(clone)
        .replace(/#/g, '%23')
        .replace(/\n/g, ' ');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT + '">' +
        '<foreignObject x="0" y="0" width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + WIDTH + 'px;min-height:' + HEIGHT + 'px;margin:0;overflow:hidden">' +
        xhtml +
        '</div></foreignObject></svg>';

      const image = new Image();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const context = canvas.getContext('2d', { alpha: false });
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, WIDTH, HEIGHT);
          context.drawImage(image, 0, 0, WIDTH, HEIGHT);
          const pngDataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          post({ type: 'ui-studio-capture', pngDataUrl, width: WIDTH, height: HEIGHT });
        } catch (caught) {
          URL.revokeObjectURL(url);
          post({ type: 'ui-studio-capture-error', message: String(caught?.message || caught) });
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        post({ type: 'ui-studio-capture-error', message: 'The browser could not rasterize the generated preview.' });
      };
      image.src = url;
    } catch (caught) {
      post({ type: 'ui-studio-capture-error', message: String(caught?.message || caught) });
    }
  }

  window.addEventListener('load', () => {
    setTimeout(capture, 250);
  }, { once: true });
})();
</script>`;
}

function injectCaptureRuntime(html, width, height) {
  const runtime = captureRuntime(width, height);
  const viewportCss = '<style>html,body{margin:0!important;width:' + width + 'px!important;min-width:' + width + 'px!important;min-height:' + height + 'px!important;overflow:hidden!important;background:#fff}*{box-sizing:border-box}</style>';
  let output = String(html || '');
  if (!/<meta\s+name=["']viewport["']/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
  }
  output = output.replace(/<head([^>]*)>/i, '<head$1>' + viewportCss);
  if (/<\/body>/i.test(output)) return output.replace(/<\/body>/i, runtime + '</body>');
  return output + runtime;
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
  return [...names].slice(0, 40);
}

function entryImport(entryPath, content) {
  if (/export\s+default\b/.test(content)) {
    return `import Entry from './${entryPath.replace(/\\/g, '/')}';`;
  }
  const named = content.match(/export\s+(?:function|const|class)\s+([A-Za-z_$][\w$]*)/);
  if (named) return `import { ${named[1]} as Entry } from './${entryPath.replace(/\\/g, '/')}';`;
  throw publicError('The generated entry file must export a React component.', 422, 'UI_STUDIO_VISUAL_ENTRY_EXPORT');
}

function mockPropsSource(propNames, assetProps = {}) {
  const names = [...new Set([
    ...propNames,
    'imageSrc','videoSrc','poster','logoSrc','avatarSrc','src','href','title','subtitle','description',
    'creators','items','cards','features','stats','slides','testimonials','onSelect','onClick','activeIndex'
  ])];
  const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"%3E%3Crect width="100%25" height="100%25" fill="%231a4b4b"/%3E%3Ccircle cx="450" cy="620" r="190" fill="%232c7772"/%3E%3Crect x="235" y="850" width="430" height="380" rx="180" fill="%23245f5c"/%3E%3C/svg%3E';
  const keys = JSON.stringify(names);
  const assets = JSON.stringify(assetProps || {});
  return `
const __placeholderImage = ${JSON.stringify(image)};
const __assetProps = ${assets};
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
const __items = Array.from({ length: 6 }, (_, index) => __item(index));
const __keys = ${keys};
const __props = new Proxy({}, {
  ownKeys(){ return __keys; },
  getOwnPropertyDescriptor(){ return { enumerable: true, configurable: true }; },
  get(_target, key){
    const name = String(key);
    if (Object.prototype.hasOwnProperty.call(__assetProps, name)) return __assetProps[name];
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

function writeGeneratedFiles(root, result) {
  for (const file of result.files || []) {
    const relative = String(file.path || '').replace(/\\/g, '/');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw publicError('Generated file path is unsafe.', 422, 'UI_STUDIO_VISUAL_PATH_UNSAFE');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(file.content || ''), 'utf8');
  }
}

function inlineDistHtml(distRoot) {
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
    return '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
  });
  return html;
}

function directHtmlPreview(result, width, height, assetProps = {}) {
  const files = result.files || [];
  const htmlFile = files.find(file => file.path === result.entryFile && /\.html?$/i.test(file.path))
    || files.find(file => /\.html?$/i.test(file.path));
  const css = files.filter(file => /\.css$/i.test(file.path)).map(file => file.content).join('\n\n');
  const js = files.filter(file => /\.m?js$/i.test(file.path)).map(file => file.content).join('\n\n');

  let html = htmlFile?.content || '<!doctype html><html><head></head><body><main id="root"></main></body></html>';
  for (const [key, value] of Object.entries(assetProps || {})) {
    const token = '{{' + key + '}}';
    html = html.split(token).join(String(value || ''));
  }
  html = html.replace(/<link[^>]+href=["'][^"']+\.css[^"']*["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/gi, '');
  const styleTag = css ? '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>' : '';
  const scriptTag = js ? '<script>' + escapeForScript(js) + '</script>' : '';
  html = html.replace(/<\/head>/i, styleTag + '</head>');
  html = html.replace(/<\/body>/i, scriptTag + '</body>');
  return injectCaptureRuntime(html, width, height);
}

function buildReactPreview(result, project, width, height, assetProps = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inx-ui-preview-'));
  try {
    validateGeneratedSources(result);
    writeGeneratedFiles(tempRoot, result);

    const linkTarget = path.join(tempRoot, 'node_modules');
    try { fs.symlinkSync(FRONTEND_NODE_MODULES, linkTarget, 'dir'); } catch (_) {
      if (!fs.existsSync(linkTarget)) throw publicError('Preview dependencies are unavailable on this runtime.', 503, 'UI_STUDIO_VISUAL_RUNTIME_MISSING');
    }

    const entryPath = String(result.entryFile || '').replace(/\\/g, '/');
    const entryFile = path.resolve(tempRoot, entryPath);
    if (!entryFile.startsWith(tempRoot + path.sep) || !fs.existsSync(entryFile)) {
      throw publicError('The generated entry file is missing.', 422, 'UI_STUDIO_VISUAL_ENTRY_MISSING');
    }
    const entryContent = fs.readFileSync(entryFile, 'utf8');
    const importLine = entryImport(entryPath, entryContent);
    const props = mockPropsSource(inferredPropNames(entryContent), assetProps);

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

    fs.writeFileSync(path.join(tempRoot, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI Studio Preview</title></head><body><div id="root"></div><script type="module" src="/__ui_studio_main.tsx"></script></body></html>`, 'utf8');

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
    assetsInlineLimit: 10000000,
    sourcemap: false,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
`;
    const configPath = path.join(tempRoot, 'vite.config.mjs');
    fs.writeFileSync(configPath, config, 'utf8');

    const run = spawnSync(process.execPath, [VITE_CLI, 'build', '--config', configPath], {
      cwd: tempRoot,
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production' }
    });
    if (run.error) {
      throw publicError('The isolated preview build could not start: ' + String(run.error.message || run.error).slice(0, 400), 500, 'UI_STUDIO_VISUAL_BUILD_START_FAILED');
    }
    if (run.status !== 0) {
      const detail = String(run.stderr || run.stdout || 'Unknown build error').replace(/\s+/g, ' ').slice(-1200);
      throw publicError('The generated code could not be rendered. ' + detail, 422, 'UI_STUDIO_VISUAL_BUILD_FAILED');
    }

    const distRoot = path.join(tempRoot, 'dist');
    const html = inlineDistHtml(distRoot);
    return injectCaptureRuntime(html, width, height);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function buildPreviewHtml(result, project, width, height, assetProps = {}) {
  validateGeneratedSources(result);
  if (project.framework === 'HTML_CSS') return directHtmlPreview(result, width, height, assetProps);
  return buildReactPreview(result, project, width, height, assetProps);
}

async function persistArtifact(renderId, data, mimeType, originalName) {
  const status = objectStorage.providerStatus();
  if (!status.cloudflareR2Configured) {
    throw publicError('Cloudflare R2 is required for visual comparison artifacts.', 503, 'UI_STUDIO_VISUAL_R2_REQUIRED');
  }
  const stored = await objectStorage.persistBuffer({
    userId: 'render-' + renderId,
    data,
    mimeType,
    originalName,
    prefix: 'ui-studio'
  });
  if (stored.storageProvider !== objectStorage.PROVIDERS.CLOUDFLARE_R2 || !stored.storageKey) {
    if (stored.storageKey) await objectStorage.deleteObject(stored.storageKey, stored.storageProvider).catch(() => {});
    throw publicError('Visual artifact could not be stored in Cloudflare R2.', 503, 'UI_STUDIO_VISUAL_R2_REQUIRED');
  }
  return stored;
}

function renderAssetUrl(renderId, kind) {
  return `/api/admin/ui-studio/renders/${encodeURIComponent(renderId)}/assets/${encodeURIComponent(kind)}`;
}

function previewUrl(renderId) {
  return `/api/admin/ui-studio/renders/${encodeURIComponent(renderId)}/preview`;
}

function serializeRender(row, { full = true } = {}) {
  if (!row) return null;
  const metrics = safeParse(row.metricsJson, null);
  const critique = safeParse(row.critiqueJson, null);
  return {
    id: row.id,
    projectId: row.projectId,
    generationId: row.generationId,
    referenceId: row.referenceId,
    parentRenderId: row.parentRenderId || null,
    viewport: row.viewport,
    status: row.status,
    version: row.version || VISUAL_VERSION,
    width: row.width,
    height: row.height,
    sourceWidth: row.sourceWidth,
    sourceHeight: row.sourceHeight,
    sourceScale: Number(row.sourceScale || 1),
    repairDepth: row.repairDepth || 0,
    batchId: row.batchId || null,
    workerId: row.workerId || null,
    attempts: row.attempts || 0,
    autoRepair: row.autoRepair !== false,
    score: metrics?.combinedScore ?? metrics?.pixelScore ?? null,
    pixelScore: metrics?.pixelScore ?? null,
    metrics,
    critique: full ? critique : null,
    errorMessage: row.errorMessage || null,
    previewUrl: row.previewStorageKey ? previewUrl(row.id) : null,
    renderedUrl: row.renderedStorageKey ? renderAssetUrl(row.id, 'rendered') : null,
    diffUrl: row.diffStorageKey ? renderAssetUrl(row.id, 'diff') : null,
    originalUrl: row.referenceId ? `/api/admin/ui-studio/references/${encodeURIComponent(row.referenceId)}/content` : null,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt
  };
}

async function prepareRender(projectId, input = {}, createdByUserId = null) {
  const id = String(projectId || '').trim();
  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      generations: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const viewport = uiStudioAnalysis.VIEWPORT_ORDER.includes(String(input.viewport || '').toUpperCase())
    ? String(input.viewport).toUpperCase()
    : 'DESKTOP';
  const references = uiStudioAnalysis.latestReferences(project.references);
  const reference = references.find(item => item.viewport === viewport);
  if (!reference) throw publicError('Upload a ' + viewport.toLowerCase() + ' reference before visual comparison.', 422, 'UI_STUDIO_VISUAL_REFERENCE_REQUIRED');

  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const currentAnalysis = project.analyses[0] || null;
  if (!currentAnalysis || currentAnalysis.status !== 'COMPLETED' || currentAnalysis.sourceFingerprint !== fingerprint) {
    throw publicError('Run Phase 2 analysis on the latest references before visual comparison.', 422, 'UI_STUDIO_VISUAL_ANALYSIS_REQUIRED');
  }

  const requestedGenerationId = String(input.generationId || '').trim();
  const generation = requestedGenerationId
    ? project.generations.find(item => item.id === requestedGenerationId)
    : project.generations[0];
  if (!generation || !['READY','READY_WITH_WARNINGS'].includes(generation.status) || !generation.generationJson) {
    throw publicError('Generate responsive code in Phase 3 before rendering it.', 422, 'UI_STUDIO_VISUAL_GENERATION_REQUIRED');
  }
  if (generation.sourceFingerprint !== fingerprint || generation.sourceAnalysisId !== currentAnalysis.id) {
    throw publicError('The selected code version is stale. Regenerate it from the current analysis.', 422, 'UI_STUDIO_VISUAL_GENERATION_STALE');
  }

  const generationResult = safeParse(generation.generationJson, null);
  if (!generationResult) throw publicError('The selected code version is incomplete.', 422, 'UI_STUDIO_VISUAL_GENERATION_INVALID');
  const viewportSize = fitViewport(reference.width, reference.height);
  const repairDepth = Math.max(0, Math.min(Number(env.uiStudioVisual?.maxRepairPasses || 3), Number(input.repairDepth || 0)));

  const row = await prisma.uiDesignRender.create({
    data: {
      projectId: project.id,
      generationId: generation.id,
      referenceId: reference.id,
      parentRenderId: input.parentRenderId ? String(input.parentRenderId) : null,
      viewport,
      status: 'PREPARING',
      version: VISUAL_VERSION,
      width: viewportSize.width,
      height: viewportSize.height,
      sourceWidth: reference.width,
      sourceHeight: reference.height,
      sourceScale: viewportSize.scale,
      repairDepth,
      createdByUserId: createdByUserId ? String(createdByUserId) : null
    }
  });

  await prisma.uiDesignProject.update({ where: { id: project.id }, data: { status: 'RENDER_PREPARING' } });

  try {
    const html = buildPreviewHtml(generationResult, project, viewportSize.width, viewportSize.height);
    const stored = await persistArtifact(row.id, Buffer.from(html, 'utf8'), 'text/html; charset=utf-8', viewport.toLowerCase() + '-preview.html');
    const updated = await prisma.uiDesignRender.update({
      where: { id: row.id },
      data: {
        status: 'PREPARED',
        previewStorageProvider: stored.storageProvider,
        previewStorageKey: stored.storageKey,
        previewSha256: hashText(html)
      }
    });
    await prisma.uiDesignProject.update({ where: { id: project.id }, data: { status: 'RENDER_READY' } });
    return serializeRender(updated);
  } catch (caught) {
    const message = String(caught.publicMessage || caught.message || 'Preview preparation failed.').slice(0, 1400);
    await prisma.uiDesignRender.update({
      where: { id: row.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() }
    }).catch(() => {});
    await prisma.uiDesignProject.update({ where: { id: project.id }, data: { status: 'RENDER_FAILED' } }).catch(() => {});
    throw caught;
  }
}

async function renderDetail(renderId) {
  const row = await prisma.uiDesignRender.findUnique({ where: { id: String(renderId || '').trim() } });
  if (!row) throw publicError('UI Studio render was not found.', 404, 'UI_STUDIO_RENDER_NOT_FOUND');
  return serializeRender(row);
}

async function previewContent(renderId) {
  const row = await prisma.uiDesignRender.findUnique({ where: { id: String(renderId || '').trim() } });
  if (!row || !row.previewStorageKey) throw publicError('Preview is not available.', 404, 'UI_STUDIO_PREVIEW_NOT_FOUND');
  const data = await objectStorage.getBuffer(row.previewStorageKey, null, row.previewStorageProvider);
  return { data, etag: '"' + String(row.previewSha256 || hashText(data)) + '"' };
}

async function assetContent(renderId, kindValue) {
  const kind = String(kindValue || '').toLowerCase();
  const row = await prisma.uiDesignRender.findUnique({ where: { id: String(renderId || '').trim() } });
  if (!row) throw publicError('UI Studio render was not found.', 404, 'UI_STUDIO_RENDER_NOT_FOUND');
  let key = null;
  let provider = null;
  if (kind === 'rendered') {
    key = row.renderedStorageKey;
    provider = row.renderedStorageProvider;
  } else if (kind === 'diff') {
    key = row.diffStorageKey;
    provider = row.diffStorageProvider;
  } else {
    throw publicError('Unsupported visual artifact.', 404, 'UI_STUDIO_RENDER_ASSET_NOT_FOUND');
  }
  if (!key) throw publicError('Visual artifact is not available yet.', 404, 'UI_STUDIO_RENDER_ASSET_NOT_FOUND');
  const data = await objectStorage.getBuffer(key, null, provider);
  return { data, mimeType: 'image/png' };
}

async function rawComparable(buffer, width, height) {
  return sharp(buffer, { limitInputPixels: 200000000 })
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function imageMetrics(referenceRaw, renderedRaw, width, height, masks = []) {
  const pixels = width * height;
  let absSum = 0;
  let mismatch = 0;
  let edgeDiff = 0;
  let edgeCount = 0;
  let comparedPixels = 0;
  const diff = Buffer.alloc(pixels * 4);
  const rects = (masks || []).filter(mask => mask && mask.enabled !== false).map(mask => {
    const x = Math.max(0, Math.floor((Number(mask.xPct || 0) / 100) * width));
    const y = Math.max(0, Math.floor((Number(mask.yPct || 0) / 100) * height));
    const w = Math.max(0, Math.ceil((Number(mask.widthPct || 0) / 100) * width));
    const h = Math.max(0, Math.ceil((Number(mask.heightPct || 0) / 100) * height));
    const inset = Math.min(3, Math.floor(Math.min(w, h) / 6));
    return { left: x + inset, top: y + inset, right: x + w - inset, bottom: y + h - inset };
  }).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
  const masked = (x, y) => rects.some(rect => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom);

  function gray(buffer, offset) {
    return (buffer[offset] * 0.299) + (buffer[offset + 1] * 0.587) + (buffer[offset + 2] * 0.114);
  }

  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const x = index % width;
    const y = Math.floor(index / width);
    if (masked(x, y)) {
      diff[offset] = 226;
      diff[offset + 1] = 232;
      diff[offset + 2] = 240;
      diff[offset + 3] = 255;
      continue;
    }
    comparedPixels += 1;
    const dr = Math.abs(referenceRaw[offset] - renderedRaw[offset]);
    const dg = Math.abs(referenceRaw[offset + 1] - renderedRaw[offset + 1]);
    const db = Math.abs(referenceRaw[offset + 2] - renderedRaw[offset + 2]);
    const normalized = (dr + dg + db) / (3 * 255);
    absSum += normalized;
    if (normalized > 0.08) mismatch += 1;

    const intensity = Math.max(0, Math.min(255, Math.round(normalized * 510)));
    diff[offset] = 255;
    diff[offset + 1] = Math.max(0, 255 - intensity);
    diff[offset + 2] = Math.max(0, 255 - intensity);
    diff[offset + 3] = 255;

    if (x > 0 && y > 0 && !masked(x - 1, y) && !masked(x, y - 1)) {
      const left = offset - 4;
      const up = offset - (width * 4);
      const refEdge = Math.abs(gray(referenceRaw, offset) - gray(referenceRaw, left))
        + Math.abs(gray(referenceRaw, offset) - gray(referenceRaw, up));
      const outEdge = Math.abs(gray(renderedRaw, offset) - gray(renderedRaw, left))
        + Math.abs(gray(renderedRaw, offset) - gray(renderedRaw, up));
      edgeDiff += Math.min(1, Math.abs(refEdge - outEdge) / 510);
      edgeCount += 1;
    }
  }

  const mae = comparedPixels ? absSum / comparedPixels : 0;
  const mismatchPct = comparedPixels ? mismatch / comparedPixels : 0;
  const edgeMae = edgeCount ? edgeDiff / edgeCount : 1;
  const pixelScore = Math.max(0, Math.min(100, Math.round(100 * (1 - (0.55 * mae + 0.30 * mismatchPct + 0.15 * edgeMae)))));
  const colorScore = Math.max(0, Math.min(100, Math.round(100 * (1 - mae))));
  const structuralScore = Math.max(0, Math.min(100, Math.round(100 * (1 - edgeMae))));

  return {
    diff,
    metrics: {
      pixelScore,
      colorScore,
      structuralScore,
      meanAbsoluteError: Number(mae.toFixed(5)),
      mismatchPercent: Number((mismatchPct * 100).toFixed(2)),
      edgeError: Number(edgeMae.toFixed(5)),
      compareWidth: width,
      compareHeight: height,
      ignoredMaskCount: rects.length,
      comparedPixelPercent: Number((pixels ? (comparedPixels / pixels) * 100 : 0).toFixed(2))
    }
  };
}

function critiqueSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary','layoutScore','typographyScore','colorScore','spacingScore','mediaScore','issues','strengths','repairPriority'],
    properties: {
      summary: { type: 'string' },
      layoutScore: { type: 'integer', minimum: 0, maximum: 100 },
      typographyScore: { type: 'integer', minimum: 0, maximum: 100 },
      colorScore: { type: 'integer', minimum: 0, maximum: 100 },
      spacingScore: { type: 'integer', minimum: 0, maximum: 100 },
      mediaScore: { type: 'integer', minimum: 0, maximum: 100 },
      issues: {
        type: 'array',
        maxItems: 18,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['severity','category','description','repairInstruction'],
          properties: {
            severity: { type: 'string', enum: ['CRITICAL','HIGH','MEDIUM','LOW'] },
            category: { type: 'string', enum: ['LAYOUT','TYPOGRAPHY','COLOR','SPACING','MEDIA','CONTENT','RESPONSIVE','OTHER'] },
            description: { type: 'string' },
            repairInstruction: { type: 'string' }
          }
        }
      },
      strengths: { type: 'array', maxItems: 10, items: { type: 'string' } },
      repairPriority: { type: 'array', maxItems: 12, items: { type: 'string' } }
    }
  };
}

async function imageDataUrl(buffer) {
  const data = await sharp(buffer, { limitInputPixels: 200000000 })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return 'data:image/jpeg;base64,' + data.toString('base64');
}

async function visualCritique(referenceBuffer, renderedBuffer, metrics, viewport) {
  if (!env.uiStudioVisual?.apiKey) return null;
  const [original, rendered] = await Promise.all([imageDataUrl(referenceBuffer), imageDataUrl(renderedBuffer)]);
  const payload = {
    model: env.uiStudioVisual.model,
    instructions: [
      'You are INXSocial UI Studio Phase 4 visual QA.',
      'Compare the ORIGINAL reference against the RENDERED generated UI.',
      'This is reconstruction QA, not redesign. Penalise differences from the reference even if the rendered version looks attractive.',
      'Focus on geometry, alignment, typography scale/weight/wrapping, colour/gradient, spacing, radii/shadows and media placement.',
      'Do not ask for new features. Every repair instruction must be concrete and code-actionable.',
      'Use the supplied pixel metrics as supporting evidence, not as a substitute for visual inspection.',
      'Return only JSON matching the schema.'
    ].join(' '),
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Viewport: ' + viewport + '\nPixel metrics: ' + JSON.stringify(metrics) + '\nImage 1 is ORIGINAL. Image 2 is RENDERED.' },
        { type: 'input_text', text: 'ORIGINAL' },
        { type: 'input_image', image_url: original, detail: 'high' },
        { type: 'input_text', text: 'RENDERED' },
        { type: 'input_image', image_url: rendered, detail: 'high' }
      ]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_visual_critique',
        strict: true,
        schema: critiqueSchema()
      }
    },
    max_output_tokens: 7000
  };
  if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) {
    payload.reasoning = { effort: env.uiStudioVisual.reasoningEffort || 'high' };
  }

  try {
    const response = await axios.post(env.uiStudioVisual.baseUrl + '/responses', payload, {
      timeout: env.uiStudioVisual.timeoutMs,
      maxBodyLength: 25 * 1024 * 1024,
      maxContentLength: 25 * 1024 * 1024,
      headers: { Authorization: 'Bearer ' + env.uiStudioVisual.apiKey, 'Content-Type': 'application/json' }
    });
    return parseJsonObject(webResearch.extractResponseText(response.data));
  } catch (caught) {
    console.warn('[ui-studio] visual critique failed', {
      status: Number(caught?.response?.status || 0),
      detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
    });
    return null;
  }
}

function combinedScore(metrics, critique) {
  if (!critique) return metrics.pixelScore;
  const ai = [
    critique.layoutScore,
    critique.typographyScore,
    critique.colorScore,
    critique.spacingScore,
    critique.mediaScore
  ].map(Number).filter(Number.isFinite);
  const aiAverage = ai.length ? ai.reduce((sum, value) => sum + value, 0) / ai.length : metrics.pixelScore;
  return Math.max(0, Math.min(100, Math.round((metrics.pixelScore * 0.55) + (aiAverage * 0.45))));
}

async function compareCapture(renderId, captureBuffer) {
  if (!Buffer.isBuffer(captureBuffer) || !captureBuffer.length) {
    throw publicError('Captured preview PNG is empty.', 400, 'UI_STUDIO_VISUAL_CAPTURE_EMPTY');
  }
  if (captureBuffer.length > MAX_CAPTURE_BYTES) {
    throw publicError('Captured preview PNG is too large.', 413, 'UI_STUDIO_VISUAL_CAPTURE_TOO_LARGE');
  }

  const row = await prisma.uiDesignRender.findUnique({
    where: { id: String(renderId || '').trim() },
    include: { reference: true }
  });
  if (!row) throw publicError('UI Studio render was not found.', 404, 'UI_STUDIO_RENDER_NOT_FOUND');
  if (!['PREPARED','COMPARING'].includes(row.status)) {
    if (row.status === 'COMPLETED') return serializeRender(row);
    throw publicError('This render is not ready to receive a capture.', 409, 'UI_STUDIO_VISUAL_CAPTURE_STATE');
  }

  let metadata;
  try {
    metadata = await sharp(captureBuffer, { limitInputPixels: 200000000 }).metadata();
  } catch (_) {
    throw publicError('Captured preview is not a valid PNG image.', 415, 'UI_STUDIO_VISUAL_CAPTURE_INVALID');
  }
  if (metadata.format !== 'png') throw publicError('Captured preview must be PNG.', 415, 'UI_STUDIO_VISUAL_CAPTURE_INVALID');

  await prisma.uiDesignRender.update({ where: { id: row.id }, data: { status: 'COMPARING' } });

  try {
    const referenceBuffer = await objectStorage.getBuffer(row.reference.storageKey, null, row.reference.storageProvider);
    const compareScale = Math.min(1, COMPARE_MAX_DIMENSION / Math.max(row.width, row.height));
    const compareWidth = Math.max(1, Math.round(row.width * compareScale));
    const compareHeight = Math.max(1, Math.round(row.height * compareScale));
    const [referenceRaw, renderedRaw] = await Promise.all([
      rawComparable(referenceBuffer, compareWidth, compareHeight),
      rawComparable(captureBuffer, compareWidth, compareHeight)
    ]);
    const measured = imageMetrics(referenceRaw, renderedRaw, compareWidth, compareHeight);
    const diffBuffer = await sharp(measured.diff, {
      raw: { width: compareWidth, height: compareHeight, channels: 4 }
    }).png({ compressionLevel: 9 }).toBuffer();

    const [renderedStored, diffStored, critique] = await Promise.all([
      persistArtifact(row.id, captureBuffer, 'image/png', row.viewport.toLowerCase() + '-rendered.png'),
      persistArtifact(row.id, diffBuffer, 'image/png', row.viewport.toLowerCase() + '-diff.png'),
      visualCritique(referenceBuffer, captureBuffer, measured.metrics, row.viewport)
    ]);

    const metrics = {
      ...measured.metrics,
      combinedScore: combinedScore(measured.metrics, critique),
      targetScore: Number(env.uiStudioVisual?.targetScore || 90),
      critiqueAvailable: Boolean(critique)
    };

    const updated = await prisma.uiDesignRender.update({
      where: { id: row.id },
      data: {
        status: 'COMPLETED',
        renderedStorageProvider: renderedStored.storageProvider,
        renderedStorageKey: renderedStored.storageKey,
        diffStorageProvider: diffStored.storageProvider,
        diffStorageKey: diffStored.storageKey,
        metricsJson: JSON.stringify(metrics),
        critiqueJson: critique ? JSON.stringify(critique) : null,
        completedAt: new Date(),
        errorMessage: null
      }
    });
    await prisma.uiDesignProject.update({ where: { id: row.projectId }, data: { status: 'VISUAL_REVIEW_READY' } });
    return serializeRender(updated);
  } catch (caught) {
    const message = String(caught.publicMessage || caught.message || 'Visual comparison failed.').slice(0, 1400);
    await prisma.uiDesignRender.update({
      where: { id: row.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() }
    }).catch(() => {});
    await prisma.uiDesignProject.update({ where: { id: row.projectId }, data: { status: 'VISUAL_REVIEW_FAILED' } }).catch(() => {});
    throw caught;
  }
}

async function repairGeneration(renderId, createdByUserId = null) {
  const render = await prisma.uiDesignRender.findUnique({
    where: { id: String(renderId || '').trim() },
    include: {
      project: {
        include: {
          references: { orderBy: { createdAt: 'desc' }, take: 100 },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      },
      generation: true,
      reference: true
    }
  });
  if (!render) throw publicError('UI Studio render was not found.', 404, 'UI_STUDIO_RENDER_NOT_FOUND');
  if (render.status !== 'COMPLETED') throw publicError('Complete visual comparison before repairing code.', 409, 'UI_STUDIO_REPAIR_RENDER_REQUIRED');
  if (render.repairDepth >= Number(env.uiStudioVisual?.maxRepairPasses || 3)) {
    throw publicError('Maximum automatic repair passes reached for this visual run.', 409, 'UI_STUDIO_REPAIR_LIMIT');
  }

  const references = uiStudioAnalysis.latestReferences(render.project.references);
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const currentAnalysis = render.project.analyses[0] || null;
  if (!currentAnalysis || currentAnalysis.status !== 'COMPLETED' || currentAnalysis.sourceFingerprint !== fingerprint) {
    throw publicError('The analysis is stale. Re-analyse before repairing code.', 422, 'UI_STUDIO_REPAIR_ANALYSIS_STALE');
  }
  if (render.generation.sourceAnalysisId !== currentAnalysis.id || render.generation.sourceFingerprint !== fingerprint) {
    throw publicError('The rendered generation is stale. Generate code from the current analysis first.', 422, 'UI_STUDIO_REPAIR_GENERATION_STALE');
  }

  const currentResult = safeParse(render.generation.generationJson, null);
  const metrics = safeParse(render.metricsJson, {});
  const critique = safeParse(render.critiqueJson, null);
  if (!currentResult) throw publicError('Rendered generation is incomplete.', 422, 'UI_STUDIO_REPAIR_GENERATION_INVALID');

  const renderedBuffer = render.renderedStorageKey
    ? await objectStorage.getBuffer(render.renderedStorageKey, null, render.renderedStorageProvider)
    : null;
  const referenceBuffer = await objectStorage.getBuffer(render.reference.storageKey, null, render.reference.storageProvider);
  if (!renderedBuffer) throw publicError('Rendered screenshot is unavailable.', 422, 'UI_STUDIO_REPAIR_RENDERED_MISSING');

  const sourceChars = (currentResult.files || []).reduce((sum, file) => sum + String(file.content || '').length, 0);
  if (sourceChars > 260000) throw publicError('This generated bundle is too large for an automatic repair pass.', 422, 'UI_STUDIO_REPAIR_BUNDLE_TOO_LARGE');

  const [originalImage, renderedImage] = await Promise.all([imageDataUrl(referenceBuffer), imageDataUrl(renderedBuffer)]);
  const analysisResult = safeParse(currentAnalysis.analysisJson, null);
  const payload = {
    model: env.uiStudioVisual.model,
    instructions: [
      'You are INXSocial UI Studio Phase 4 repair engineer.',
      'Repair the EXISTING generated code so its rendered output matches the ORIGINAL reference more closely.',
      'This is not a redesign. Do not add features, copy, components or styling that are absent from the reference.',
      'Apply the visual QA issues precisely. Preserve parts already matching the reference.',
      'Return a complete generation bundle, not a patch. Keep framework, styling and output type unchanged.',
      'Do not embed the screenshot, use remote scripts, network calls, tracking, iframes or Node APIs.',
      'Prefer normal responsive grid/flex/clamp/minmax layout; absolute positioning only for genuine overlays.',
      'Return only JSON matching the supplied schema.'
    ].join(' '),
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: [
          'PROJECT TARGET',
          JSON.stringify({
            name: render.project.name,
            framework: render.project.framework,
            styling: render.project.styling,
            outputType: render.project.outputType,
            viewport: render.viewport
          }),
          '',
          'CURRENT GENERATION',
          JSON.stringify(currentResult),
          '',
          'PHASE 2 ANALYSIS',
          JSON.stringify(analysisResult),
          '',
          'VISUAL METRICS',
          JSON.stringify(metrics),
          '',
          'VISUAL CRITIQUE',
          JSON.stringify(critique || { summary: 'AI critique unavailable; use visual images and pixel metrics.' }),
          '',
          'Image 1 is ORIGINAL. Image 2 is CURRENT RENDER.'
        ].join('\n') },
        { type: 'input_text', text: 'ORIGINAL' },
        { type: 'input_image', image_url: originalImage, detail: 'high' },
        { type: 'input_text', text: 'CURRENT RENDER' },
        { type: 'input_image', image_url: renderedImage, detail: 'high' }
      ]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'inx_ui_repaired_code',
        strict: true,
        schema: uiStudioCodegen.generationSchema()
      }
    },
    max_output_tokens: 26000
  };
  if (/^gpt-5(?:\.|-)/i.test(String(payload.model || ''))) {
    payload.reasoning = { effort: env.uiStudioVisual.reasoningEffort || 'high' };
  }

  let response;
  try {
    response = await axios.post(env.uiStudioVisual.baseUrl + '/responses', payload, {
      timeout: env.uiStudioVisual.timeoutMs,
      maxBodyLength: 45 * 1024 * 1024,
      maxContentLength: 45 * 1024 * 1024,
      headers: { Authorization: 'Bearer ' + env.uiStudioVisual.apiKey, 'Content-Type': 'application/json' }
    });
  } catch (caught) {
    const status = Number(caught?.response?.status || 0);
    console.error('[ui-studio] visual repair provider failed', {
      status,
      detail: String(caught?.response?.data?.error?.message || caught.message || '').slice(0, 500)
    });
    throw publicError('The visual repair model did not complete the repair request.', status >= 400 && status < 500 ? 502 : 504, 'UI_STUDIO_REPAIR_PROVIDER_FAILED');
  }

  const parsed = parseJsonObject(webResearch.extractResponseText(response.data));
  if (!parsed) throw publicError('The visual repair model returned an incomplete code bundle.', 502, 'UI_STUDIO_REPAIR_PARSE_FAILED');

  const repaired = uiStudioCodegen.normalizeGeneration(parsed, render.project);
  validateGeneratedSources(repaired);
  const validation = uiStudioCodegen.validateGeneration(repaired);
  const generationStatus = validation.ok ? 'READY' : 'READY_WITH_WARNINGS';
  const attemptNumber = render.repairDepth + 1;

  const output = await prisma.uiDesignGeneration.create({
    data: {
      projectId: render.projectId,
      sourceAnalysisId: currentAnalysis.id,
      status: generationStatus,
      version: uiStudioCodegen.GENERATION_VERSION,
      model: env.uiStudioVisual.model,
      framework: render.project.framework,
      styling: render.project.styling,
      outputType: render.project.outputType,
      sourceFingerprint: fingerprint,
      generationJson: JSON.stringify(repaired),
      validationJson: JSON.stringify(validation),
      parentGenerationId: render.generationId,
      repairDepth: render.repairDepth + 1,
      createdByUserId: createdByUserId ? String(createdByUserId) : null,
      completedAt: new Date()
    }
  });

  await prisma.uiDesignRepairAttempt.create({
    data: {
      projectId: render.projectId,
      renderId: render.id,
      inputGenerationId: render.generationId,
      outputGenerationId: output.id,
      attemptNumber,
      status: 'COMPLETED',
      scoreBefore: Number(metrics.combinedScore ?? metrics.pixelScore ?? 0),
      instructionsJson: JSON.stringify({
        critique: critique || null,
        metrics,
        repairPriority: critique?.repairPriority || []
      }),
      createdByUserId: createdByUserId ? String(createdByUserId) : null,
      completedAt: new Date()
    }
  });

  await prisma.uiDesignProject.update({ where: { id: render.projectId }, data: { status: 'CODE_REPAIRED' } });

  return {
    generation: uiStudioCodegen.serializeGeneration(output, {
      full: true,
      currentFingerprint: fingerprint,
      currentAnalysisId: currentAnalysis.id
    }),
    attemptNumber
  };
}

async function latestProjectRender(projectId) {
  const row = await prisma.uiDesignRender.findFirst({
    where: { projectId: String(projectId || '').trim() },
    orderBy: { createdAt: 'desc' }
  });
  return serializeRender(row, { full: false });
}

module.exports = {
  VISUAL_VERSION,
  MAX_CAPTURE_BYTES,
  MAX_RENDER_PIXELS,
  ready,
  rendererStatus,
  fitViewport,
  validateGeneratedSources,
  buildPreviewHtml,
  imageMetrics,
  rawComparable,
  persistArtifact,
  visualCritique,
  combinedScore,
  serializeRender,
  prepareRender,
  renderDetail,
  previewContent,
  assetContent,
  compareCapture,
  repairGeneration,
  latestProjectRender
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { nanoid } = require('nanoid');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);
const CAPTION_EXTENSIONS = new Set(['.txt', '.md']);

function importFiles(appStore, filePaths, type) {
  const accepted = [];
  const rejected = [];

  for (const inputPath of filePaths) {
    try {
      if (!inputPath || !fs.existsSync(inputPath)) {
        rejected.push({ path: inputPath, reason: 'File does not exist.' });
        continue;
      }

      const stat = fs.statSync(inputPath);
      if (!stat.isFile()) {
        rejected.push({ path: inputPath, reason: 'Not a file.' });
        continue;
      }

      const ext = path.extname(inputPath).toLowerCase();
      if (type === 'video' && !VIDEO_EXTENSIONS.has(ext)) {
        rejected.push({ path: inputPath, reason: 'Unsupported video format.' });
        continue;
      }
      if (type === 'caption' && !CAPTION_EXTENSIONS.has(ext)) {
        rejected.push({ path: inputPath, reason: 'Unsupported caption format.' });
        continue;
      }

      if (type === 'caption') {
        const content = fs.readFileSync(inputPath, 'utf8');
        const captionItems = createCaptionItemsFromText(appStore, content, path.basename(inputPath), inputPath, stat.size);
        // V12.8: Do not block duplicate captions. The user controls content reuse.
        // Scheduler safety is based on occupied schedule slots, not caption uniqueness.
        accepted.push(...captionItems);
      } else {
        const item = createVideoItem(appStore, inputPath, stat);
        // V12.8: Do not block duplicate videos. The user may intentionally re-upload
        // the same file in a new session. Schedule-slot safety remains enforced separately.
        accepted.push(item);
      }
    } catch (err) {
      rejected.push({ path: inputPath, reason: err.message });
    }
  }

  appendImportedItems(appStore, accepted, type);

  appStore.log('import', `Imported ${accepted.length} ${type}${accepted.length === 1 ? '' : 's'}.`, {
    accepted: accepted.length,
    rejected: rejected.length
  });

  return { accepted, rejected, state: appStore.getState() };
}

function importCaptionText(appStore, text, sourceName = 'pasted-captions.txt') {
  const raw = String(text || '');
  const captionItems = createCaptionItemsFromText(appStore, raw, sourceName, null, Buffer.byteLength(raw, 'utf8'));
  const accepted = captionItems;
  appendImportedItems(appStore, accepted, 'caption');
  appStore.log('import', `Imported ${accepted.length} pasted caption${accepted.length === 1 ? '' : 's'}.`, {
    sourceName,
    duplicatesSkipped: 0,
    note: 'Duplicate caption blocking disabled in V12.8.'
  });
  return {
    accepted,
    rejected: [],
    state: appStore.getState()
  };
}

function createVideoItem(appStore, inputPath, stat) {
  const settings = appStore.getSettings();
  const id = nanoid(12);
  const originalName = path.basename(inputPath);
  const safeName = `${id}-${sanitizeFilename(originalName)}`;
  const storedPath = settings.copyImportedFiles ? path.join(appStore.videoRoot, safeName) : inputPath;
  const videoHash = hashFileSync(inputPath);

  if (settings.copyImportedFiles) {
    fs.copyFileSync(inputPath, storedPath);
  }

  return {
    id,
    type: 'video',
    name: originalName,
    baseName: normaliseBaseName(originalName),
    originalPath: inputPath,
    path: storedPath,
    ext: path.extname(inputPath).toLowerCase(),
    size: stat.size,
    videoHash,
    videoKey: `import:${id}:${videoHash}`, // unique per import; duplicate video files are allowed
    importedAt: new Date().toISOString()
  };
}

function createCaptionItemsFromText(appStore, rawText, sourceName, originalPath, size) {
  const settings = appStore.getSettings();
  const blocks = splitCaptionBlocks(rawText, settings.captionSplitMode || 'auto');
  if (!blocks.length) return [];

  return blocks.map((block, index) => {
    const id = nanoid(12);
    const count = String(index + 1).padStart(3, '0');
    const parsedLabel = blocks.length === 1 ? stripExtension(sourceName) : `${stripExtension(sourceName)}-${count}`;
    const filename = `${parsedLabel}.txt`;
    const safeName = `${id}-${sanitizeFilename(filename)}`;
    const storedPath = path.join(appStore.captionRoot, safeName);
    const captionHash = hashText(block);
    const sourceKey = `${stripExtension(sourceName)}:${index + 1}:${captionHash}`;

    if (settings.copyImportedFiles || !originalPath || blocks.length > 1) {
      fs.writeFileSync(storedPath, block, 'utf8');
    } else {
      fs.copyFileSync(originalPath, storedPath);
    }

    return {
      id,
      type: 'caption',
      name: filename,
      baseName: normaliseBaseName(filename),
      originalPath: originalPath || `pasted:${sourceName}`,
      path: storedPath,
      ext: '.txt',
      size: Buffer.byteLength(block, 'utf8') || size || 0,
      importedAt: new Date().toISOString(),
      content: block,
      captionHash,
      captionKey: `import:${id}:${sourceKey}`, // unique per import; duplicate captions are allowed
      sourceName,
      sourceIndex: index + 1,
      sourceTotal: blocks.length
    };
  });
}

function splitCaptionBlocks(text, mode = 'auto') {
  const normalized = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) return [];

  const byLine = () => normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const byBlankLine = () => normalized
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  if (mode === 'line') return byLine();
  if (mode === 'blank-line') return byBlankLine();

  // Auto mode: if the file contains blank-line separated paragraphs, keep
  // paragraph captions. If not, treat each non-empty line as one caption.
  const paragraphBlocks = byBlankLine();
  if (paragraphBlocks.length > 1) return paragraphBlocks;

  const lines = byLine();
  return lines.length > 1 ? lines : paragraphBlocks;
}

function appendImportedItems(appStore, accepted, type) {
  if (!accepted.length) return;
  if (type === 'video') {
    appStore.setVideos([...appStore.getVideos(), ...accepted]);
  }
  if (type === 'caption') {
    appStore.setCaptions([...appStore.getCaptions(), ...accepted]);
  }
}

function findDuplicateVideo(appStore, item) {
  return (appStore.getVideos() || []).find(existing => {
    if (existing.videoHash && item.videoHash && existing.videoHash === item.videoHash) return true;
    return existing.name === item.name && Number(existing.size) === Number(item.size);
  }) || null;
}

function filterNewCaptionItems(appStore, items) {
  const existing = appStore.getCaptions() || [];
  const existingKeys = new Set(existing.map(item => item.captionKey).filter(Boolean));
  const accepted = [];
  const rejected = [];
  const seenThisImport = new Set();

  for (const item of items) {
    const key = item.captionKey || `${item.sourceName}:${item.sourceIndex}:${item.captionHash}`;
    if (existingKeys.has(key) || seenThisImport.has(key)) {
      removeCopiedFileIfNeeded(item, item.originalPath);
      rejected.push(item);
      continue;
    }
    seenThisImport.add(key);
    accepted.push(item);
  }
  return { accepted, rejected };
}

function removeCopiedFileIfNeeded(item, originalPath) {
  try {
    if (item && item.path && item.path !== originalPath && fs.existsSync(item.path)) {
      fs.rmSync(item.path, { force: true });
    }
  } catch (_) {
    // Non-critical cleanup failure.
  }
}

function collectFilesFromFolder(folderPath, type) {
  const results = [];
  const allowed = type === 'video' ? VIDEO_EXTENSIONS : CAPTION_EXTENSIONS;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      if (entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  walk(folderPath);
  return results.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normaliseBaseName(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function stripExtension(filename) {
  return path.basename(filename || 'caption', path.extname(filename || 'caption')) || 'caption';
}

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function hashFileSync(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

module.exports = {
  importFiles,
  importCaptionText,
  collectFilesFromFolder,
  normaliseBaseName,
  splitCaptionBlocks,
  hashText,
  hashFileSync,
  VIDEO_EXTENSIONS,
  CAPTION_EXTENSIONS
};

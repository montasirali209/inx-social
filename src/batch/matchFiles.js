const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);
const CAPTION_EXTENSIONS = new Set(['.txt', '.md']);
const SINGLE_CAPTION_NAMES = ['captions.txt', 'caption.txt', 'captions.md', 'caption.md'];

function matchVideosToCaptions(videosDir, captionsDir) {
  const videos = listFiles(videosDir, VIDEO_EXTENSIONS).map(filePath => ({
    videoFile: path.basename(filePath),
    videoPath: filePath,
    baseName: normaliseBaseName(path.basename(filePath)),
  }));

  if (!videos.length) return [];

  const singleCaptionPath = findSingleCaptionFile(captionsDir);
  if (singleCaptionPath) {
    const blocks = splitCaptionBlocks(fs.readFileSync(singleCaptionPath, 'utf8'));
    return videos.map((video, index) => {
      const caption = blocks[index] || '';
      return {
        ...video,
        caption,
        captionPath: caption ? singleCaptionPath : null,
        captionFile: caption ? `${path.basename(singleCaptionPath)}#${String(index + 1).padStart(3, '0')}` : null,
        matchType: 'single-file-positional',
      };
    });
  }

  const captions = listFiles(captionsDir, CAPTION_EXTENSIONS).map(filePath => ({
    captionFile: path.basename(filePath),
    captionPath: filePath,
    caption: fs.readFileSync(filePath, 'utf8').trim(),
    baseName: normaliseBaseName(path.basename(filePath)),
  }));

  const unusedCaptions = [...captions];
  const matches = [];
  const unmatchedVideos = [];

  for (const video of videos) {
    const exactIndex = unusedCaptions.findIndex(caption => caption.baseName === video.baseName);
    if (exactIndex >= 0) {
      const caption = unusedCaptions.splice(exactIndex, 1)[0];
      matches.push({ ...video, ...caption, matchType: 'exact-name' });
    } else {
      unmatchedVideos.push(video);
    }
  }

  const positionalCount = Math.min(unmatchedVideos.length, unusedCaptions.length);
  for (let i = 0; i < positionalCount; i += 1) {
    matches.push({
      ...unmatchedVideos[i],
      ...unusedCaptions[i],
      matchType: 'positional',
    });
  }

  for (let i = positionalCount; i < unmatchedVideos.length; i += 1) {
    matches.push({
      ...unmatchedVideos[i],
      caption: '',
      captionPath: null,
      captionFile: null,
      matchType: 'missing-caption',
    });
  }

  return matches.sort((a, b) => a.videoFile.localeCompare(b.videoFile, undefined, { numeric: true, sensitivity: 'base' }));
}

function listFiles(folder, allowedExtensions) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter(name => allowedExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(name => path.join(folder, name));
}

function findSingleCaptionFile(captionsDir) {
  if (!fs.existsSync(captionsDir)) return null;
  for (const name of SINGLE_CAPTION_NAMES) {
    const fullPath = path.join(captionsDir, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return fullPath;
  }
  return null;
}

function splitCaptionBlocks(text) {
  const normalized = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) return [];

  const paragraphBlocks = normalized
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) return paragraphBlocks;

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.length > 1 ? lines : paragraphBlocks;
}

function normaliseBaseName(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

module.exports = {
  matchVideosToCaptions,
  splitCaptionBlocks,
  normaliseBaseName,
  VIDEO_EXTENSIONS,
  CAPTION_EXTENSIONS,
};

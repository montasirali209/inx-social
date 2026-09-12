'use strict';

const crypto = require('node:crypto');
const zlib = require('node:zlib');
const sharp = require('sharp');
const prisma = require('../db/prisma');
const { expiresAtFor } = require('./mediaRetentionService');

const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml', 'text/rtf',
  'application/json', 'application/xml', 'application/rtf'
]);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'rtf']);

function error(message, status = 400) {
  const value = new Error(message);
  value.status = status;
  value.publicMessage = message;
  return value;
}

function safeName(value) {
  return String(value || 'reference')
    .replace(/[^a-zA-Z0-9._ ()\-]/g, '')
    .trim()
    .slice(0, 180) || 'reference';
}

function extension(name) {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodePdfLiteral(value) {
  return String(value || '')
    .replace(/\\([nrtbf()\\])/g, (_, char) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[char] || char))
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\\r?\n/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

function decodePdfHex(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean || clean.length % 2) return '';
  try {
    const data = Buffer.from(clean, 'hex');
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
      let output = '';
      for (let index = 2; index + 1 < data.length; index += 2) output += String.fromCharCode(data.readUInt16BE(index));
      return output;
    }
    return data.toString('latin1');
  } catch (_) {
    return '';
  }
}

function pdfOperatorText(source) {
  const output = [];
  const direct = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match;
  while ((match = direct.exec(source)) && output.length < 600) {
    const text = decodePdfLiteral(match[1]).trim();
    if (text) output.push(text);
  }
  const arrays = /\[((?:.|\r|\n)*?)\]\s*TJ/g;
  while ((match = arrays.exec(source)) && output.length < 900) {
    const parts = [];
    const literal = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
    let part;
    while ((part = literal.exec(match[1]))) {
      const text = part[1] !== undefined ? decodePdfLiteral(part[1]) : decodePdfHex(part[2]);
      if (text.trim()) parts.push(text.trim());
    }
    if (parts.length) output.push(parts.join(' '));
  }
  const hexDirect = /<([0-9A-Fa-f\s]{4,})>\s*Tj/g;
  while ((match = hexDirect.exec(source)) && output.length < 1000) {
    const text = decodePdfHex(match[1]).trim();
    if (text) output.push(text);
  }
  return output.join(' ');
}

function extractPdfText(data) {
  const latin = data.toString('latin1');
  const chunks = [latin];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let streams = 0;
  while ((match = streamPattern.exec(latin)) && streams < 80) {
    streams += 1;
    if (!/FlateDecode/i.test(match[1])) continue;
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[2], 'latin1'), { maxOutputLength: 4 * 1024 * 1024 });
      chunks.push(inflated.toString('latin1'));
    } catch (_) { /* unreadable stream */ }
  }
  return chunks
    .map(pdfOperatorText)
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000);
}

function stripMarkup(text, ext) {
  let value = String(text || '').replace(/\u0000/g, ' ');
  if (ext === 'html' || ext === 'htm') value = value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  if (ext === 'rtf') value = value.replace(/\\'[0-9a-f]{2}/gi, ' ').replace(/\\[a-z]+-?\d* ?/gi, ' ').replace(/[{}]/g, ' ');
  return value.replace(/\s+/g, ' ').trim().slice(0, 14000);
}

function wrapText(text, maxChars = 92) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= 58) break;
  }
  if (line && lines.length < 58) lines.push(line);
  return lines;
}

async function documentPreview(fileName, text) {
  const lines = wrapText(text || 'No readable text could be extracted from this reference document.');
  const tspans = lines.map((line, index) => `<tspan x="72" dy="${index === 0 ? 0 : 29}">${xmlEscape(line)}</tspan>`).join('');
  const svg = `
    <svg width="1600" height="2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="2000" fill="#ffffff"/>
      <rect x="48" y="48" width="1504" height="1904" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
      <text x="72" y="104" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f172a">Reference document: ${xmlEscape(fileName)}</text>
      <line x1="72" y1="132" x2="1528" y2="132" stroke="#cbd5e1" stroke-width="2"/>
      <text x="72" y="182" font-family="Arial, sans-serif" font-size="21" fill="#1e293b">${tspans}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

async function saveReference(userId, input = {}) {
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || '');
  if (!data.length) throw error('Choose a non-empty reference file.');
  if (data.length > MAX_REFERENCE_BYTES) throw error('Reference files must be 20 MB or smaller.', 413);

  const fileName = safeName(input.fileName);
  const ext = extension(fileName);
  const originalMime = String(input.mimeType || 'application/octet-stream').toLowerCase().split(';')[0];
  const isImage = IMAGE_TYPES.has(originalMime) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const isPdf = originalMime === 'application/pdf' || ext === 'pdf';
  const isText = TEXT_TYPES.has(originalMime) || originalMime.startsWith('text/') || TEXT_EXTENSIONS.has(ext);
  if (!isImage && !isPdf && !isText) {
    throw error('Use PNG, JPG, WebP, GIF, PDF, TXT, Markdown, CSV, JSON, HTML, XML or RTF as a reference.', 415);
  }

  let storedData = data;
  let storedMime = originalMime;
  let convertedToPreview = false;
  let extractedText = '';

  if (isImage) {
    try { await sharp(data, { animated: false }).metadata(); } catch (_) { throw error('This image reference could not be read.', 415); }
  } else {
    extractedText = isPdf ? extractPdfText(data) : stripMarkup(data.toString('utf8'), ext);
    if (!extractedText) throw error(isPdf ? 'No readable text could be extracted from this PDF. Try a text-based PDF or add screenshots of the relevant pages.' : 'No readable text could be extracted from this reference file.', 422);
    storedData = await documentPreview(fileName, extractedText);
    storedMime = 'image/png';
    convertedToPreview = true;
  }

  const checksum = crypto.createHash('sha256').update(storedData).digest('hex');
  const existing = await prisma.agentAsset.findFirst({ where: { userId, checksum, status: 'READY', archivedAt: null } });
  if (existing) {
    return { id: existing.id, fileName, mimeType: originalMime, byteSize: data.length, convertedToPreview };
  }

  const metadata = await sharp(storedData, { animated: false }).metadata().catch(() => ({}));
  const record = await prisma.agentAsset.create({
    data: {
      userId,
      kind: convertedToPreview ? 'AI_REFERENCE_DOCUMENT' : 'AI_REFERENCE_IMAGE',
      source: 'AI_STUDIO_REFERENCE',
      status: 'READY',
      originalName: fileName,
      mimeType: storedMime,
      byteSize: storedData.length,
      checksum,
      customerPrompt: convertedToPreview ? extractedText.slice(0, 10000) : null,
      generationChoice: JSON.stringify({ originalMime, convertedToPreview }),
      tagsJson: JSON.stringify(['ai-studio-reference', convertedToPreview ? 'document-reference' : 'image-reference']),
      data: storedData,
      width: Number(metadata.width || 0) || null,
      height: Number(metadata.height || 0) || null,
      expiresAt: expiresAtFor(storedMime)
    }
  });
  return { id: record.id, fileName, mimeType: originalMime, byteSize: data.length, convertedToPreview };
}

module.exports = { MAX_REFERENCE_BYTES, saveReference, extractPdfText };

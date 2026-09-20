const publishing = require('../services/postForMePublishingService');
const mutations = require('../services/postForMePostMutationService');

async function readBody(req, maxBytes = 500 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error('Media uploads must be 500 MB or smaller.'), {
        status: 413,
        publicMessage: 'Media uploads must be 500 MB or smaller.'
      });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function list(req, res, next) {
  try {
    res.json({ jobs: await publishing.listPublications(req.user.id, req.query.limit) });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const result = await publishing.createPublications(req.user.id, req.body || {});
    res.status(result.failures.length ? 207 : 201).json(result);
  } catch (error) { next(error); }
}

async function createCarousel(req, res, next) {
  try {
    const input = { ...(req.body || {}), contentType: 'IMAGE' };
    const result = await publishing.createPublications(req.user.id, input);
    res.status(result.failures.length ? 207 : 201).json(result);
  } catch (error) { next(error); }
}

async function uploadMedia(req, res, next) {
  try {
    const job = await publishing.attachMediaStream(req.user.id, req.params.publicationId, {
      stream: req,
      contentLength: req.headers['content-length'],
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      fileName: String(req.headers['x-file-name'] || '') || null
    });
    res.json({ job, accepted: true, scheduled: job.status === 'SCHEDULED', published: job.status === 'PUBLISHED' });
  } catch (error) { next(error); }
}

async function updateScheduled(req, res, next) {
  try {
    res.json(await mutations.update(req.user.id, req.params.publicationId, {
      title: req.body?.title,
      caption: req.body?.caption,
      scheduledAt: req.body?.scheduledAt
    }));
  } catch (error) { next(error); }
}

async function replaceScheduledMedia(req, res, next) {
  try {
    const media = await publishing.uploadStream(req, {
      contentLength: req.headers['content-length'],
      mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0]
    });
    const result = await mutations.update(req.user.id, req.params.publicationId, {
      providerMedia: [media]
    });
    res.json({ ...result, mediaReplaced: true });
  } catch (error) { next(error); }
}

async function libraryMedia(req, res, next) {
  try {
    const job = await publishing.attachLibraryMedia(req.user.id, req.params.publicationId);
    res.json({ job, accepted: true, scheduled: job.status === 'SCHEDULED', published: job.status === 'PUBLISHED', reusableMedia: true });
  } catch (error) { next(error); }
}

async function feed(req, res, next) {
  try {
    const result = await publishing.getFeed(req.user.id, req.params.profileId, {
      limit: req.query.limit,
      cursor: req.query.cursor,
      expandMetrics: String(req.query.expandMetrics || 'true').toLowerCase() !== 'false'
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    res.json(await mutations.remove(req.user.id, req.params.publicationId));
  } catch (error) { next(error); }
}

async function reschedule(req, res, next) {
  try {
    res.json(await mutations.reschedule(req.user.id, req.params.publicationId, req.body?.scheduledAt));
  } catch (error) { next(error); }
}

module.exports = { list, create, createCarousel, uploadMedia, libraryMedia, feed, remove, reschedule, updateScheduled, replaceScheduledMedia };

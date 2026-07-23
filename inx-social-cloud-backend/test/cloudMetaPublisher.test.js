const assert = require('node:assert/strict');
const test = require('node:test');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const axios = require('axios');
const publisher = require('../src/services/cloudMetaPublisher');

test('scheduled Reel publishing uses fixed-length streaming and the three Meta phases', async t => {
  const posts = [];
  t.mock.method(fs, 'createReadStream', () => Readable.from(Buffer.from('video')));
  t.mock.method(axios, 'post', async (url, body, options) => {
    posts.push({ url, body, options });
    if (posts.length === 1) return { status: 200, data: { video_id: 'video-1', upload_url: 'https://rupload.facebook.com/session' } };
    if (posts.length === 2) return { status: 200, data: { success: true } };
    return { status: 200, data: { success: true, post_id: 'post-1' } };
  });

  const result = await publisher.publishScheduledReel({
    pageId: 'page-1',
    pageAccessToken: 'page-secret',
    filePath: '/temporary/video.mp4',
    fileSize: 5,
    caption: 'Cloud caption',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  assert.equal(posts.length, 3);
  assert.equal(posts[0].body.upload_phase, 'start');
  assert.equal(posts[1].options.headers['Content-Length'], '5');
  assert.equal(posts[1].options.headers['X-Entity-Length'], '5');
  assert.equal(posts[1].options.headers.Authorization, 'OAuth page-secret');
  assert.equal(posts[2].body.upload_phase, 'finish');
  assert.equal(posts[2].body.video_state, 'SCHEDULED');
  assert.equal(result.videoId, 'video-1');
  assert.equal(result.postId, 'post-1');
});

test('scheduled Reel publishing refuses a past time before contacting Meta', async t => {
  const post = t.mock.method(axios, 'post', async () => ({ status: 200, data: {} }));
  await assert.rejects(
    publisher.publishScheduledReel({
      pageId: 'page-1',
      pageAccessToken: 'page-secret',
      filePath: '/temporary/video.mp4',
      fileSize: 5,
      caption: '',
      scheduledAt: new Date(Date.now() - 1000)
    }),
    /no longer in the future/
  );
  assert.equal(post.mock.callCount(), 0);
});

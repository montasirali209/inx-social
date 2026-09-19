'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MEDIA_BUCKET = 'inx-test-bucket';
process.env.MEDIA_S3_ENDPOINT = 'https://storage.example.test';
process.env.MEDIA_S3_REGION = 'auto';
process.env.MEDIA_S3_ACCESS_KEY_ID = 'test-access-key';
process.env.MEDIA_S3_SECRET_ACCESS_KEY = 'test-secret-key';

const storage = require('../src/services/mediaObjectStorageService');

test('media object storage signs virtual-hosted bucket requests', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      status: options.method === 'GET' && options.headers.Range ? 206 : 200,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      text: async () => ''
    };
  };

  try {
    const key = storage.keyFor('user/one', 'asset one', 'My image.png');
    assert.equal(key, 'media/user-one/' + new Date().toISOString().slice(0, 10) + '/asset-one/My-image.png');

    await storage.putObject(key, Buffer.from('hello'), 'image/png');
    assert.equal(requests[0].options.method, 'PUT');
    assert.match(requests[0].url, /^https:\/\/inx-test-bucket\.storage\.example\.test\/media\//);
    assert.match(requests[0].options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=test-access-key\//);
    assert.equal(requests[0].options.headers['content-type'], 'image/png');

    const range = await storage.getObjectRange(key, 5, 3);
    assert.deepEqual([...range], [1, 2, 3]);
    assert.equal(requests[1].options.headers.Range, 'bytes=5-7');

    await storage.deleteObject(key);
    assert.equal(requests[2].options.method, 'DELETE');
  } finally {
    global.fetch = originalFetch;
  }
});

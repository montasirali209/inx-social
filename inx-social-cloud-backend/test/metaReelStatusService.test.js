const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseReelStatus, isDefinitiveMissingMetaObject } = require('../src/services/metaReelStatusService');

test('scheduled Reel remains processing until Meta processing completes', () => {
  assert.equal(normaliseReelStatus({
    status: {
      video_status: 'processing',
      uploading_phase: { status: 'complete' },
      processing_phase: { status: 'in_progress' }
    }
  }, 'SCHEDULED').state, 'PROCESSING');
});

test('scheduled Reel is confirmed only after Meta reports ready processing', () => {
  assert.equal(normaliseReelStatus({
    status: {
      video_status: 'ready',
      uploading_phase: { status: 'complete' },
      processing_phase: { status: 'complete' }
    }
  }, 'SCHEDULED').state, 'SCHEDULED');
});

test('Meta processing error is retained as the final job error', () => {
  const result = normaliseReelStatus({
    status: {
      video_status: 'error',
      processing_phase: {
        status: 'error',
        errors: [{ message: 'Video could not be processed.' }]
      }
    }
  }, 'SCHEDULED');
  assert.equal(result.state, 'FAILED');
  assert.match(result.error, /could not be processed/i);
});

test('immediate Reel requires publishing confirmation', () => {
  assert.equal(normaliseReelStatus({
    status: {
      video_status: 'ready',
      processing_phase: { status: 'complete' },
      publishing_phase: { status: 'in_progress' }
    }
  }, 'NOW').state, 'PROCESSING');
  assert.equal(normaliseReelStatus({
    status: {
      video_status: 'published',
      publishing_phase: { status: 'complete' }
    }
  }, 'NOW').state, 'PUBLISHED');
});

test('a definitive missing Meta object releases the filename for retry', () => {
  const error = new Error('Unsupported get request. Object with ID does not exist.');
  error.meta = { error: { code: 100, error_subcode: 33, message: error.message } };
  assert.equal(isDefinitiveMissingMetaObject(error), true);
});

test('a temporary Meta error does not release an existing Reel', () => {
  const error = new Error('Meta request timed out.');
  assert.equal(isDefinitiveMissingMetaObject(error), false);
});

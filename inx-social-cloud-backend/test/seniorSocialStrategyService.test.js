const assert = require('node:assert/strict');
const test = require('node:test');
const senior = require('../src/services/seniorSocialStrategyService');

test('senior strategy gate approves complete human customer-focused copy', () => {
  const content = JSON.stringify({ posts: [{
    title: 'Welcome to a calmer content workflow',
    caption: 'Great social content starts with good ideas, but keeping everything organised can take time. INX Social helps creators, growing businesses and teams bring planning and publishing work into a clearer rhythm. Organise what comes next, stay consistent and spend less time chasing scattered tasks. Ready for a calmer way to plan your social presence? Discover INX Social.',
    altText: 'Scattered content ideas flowing into one organised publishing path in navy and cyan.',
    hashtags: ['SocialMediaPlanning', 'ContentStrategy', 'SmallBusinessUK'],
    visualBrief: 'A premium navy and cyan transformation from scattered creative ideas into an organised content flow.',
    objective: 'Introduce the service and encourage qualified Page visitors to discover it.'
  }] });
  const review = senior.reviewCopyOutput({ prompt: 'Create our first Facebook post' }, content, 1);
  assert.equal(review.approved, true);
  assert.ok(review.score >= 75);
});

test('senior strategy gate rejects weak structured copy and prohibited visuals', () => {
  const content = JSON.stringify({ posts: [{ title: '', caption: 'Best in the UK!', hashtags: [], visualBrief: 'Use a fake dashboard phone mockup.' }] });
  const review = senior.reviewCopyOutput({ prompt: 'Create our first Facebook post' }, content, 1);
  assert.equal(review.approved, false);
  assert.match(review.issues.join(' '), /accessibility|unsupported|prohibited/i);
});

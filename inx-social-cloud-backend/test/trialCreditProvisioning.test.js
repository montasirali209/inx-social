const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('trial credits are provisioned when email verification activates the trial', () => {
  const auth = read('src/controllers/authController.js');
  const credits = read('src/services/aiCreditService.js');

  assert.match(auth, /const aiCredits = require\('\.\.\/services\/aiCreditService'\)/);
  assert.match(auth, /await aiCredits\.provisionWallet\(user\.id\)/);
  assert.match(auth, /TRIAL CREDIT PROVISION FAILED/);
  assert.match(credits, /async function provisionWallet\(userId/);
  assert.match(credits, /provisionOnly: true/);
  assert.match(credits, /entitlement\.plan === 'trial' \? 'TRIAL_GRANT' : 'MONTHLY_GRANT'/);
  assert.match(credits, /provisionWallet,/);
});

test('normal AI access still enforces studio policy while provisioning can create the entitlement wallet', () => {
  const credits = read('src/services/aiCreditService.js');
  assert.match(credits, /const provisionOnly = options\.provisionOnly === true/);
  assert.match(credits, /if \(!entitlement\.studioEnabled && !provisionOnly\)/);
  assert.match(credits, /if \(!planEligible\)/);
});


test('admin customer inspection reads balances without provisioning a wallet', () => {
  const admin = read('src/controllers/adminController.js');
  const credits = read('src/services/aiCreditService.js');

  assert.match(admin, /aiCredits\.peekBalance\(userId\)/);
  assert.doesNotMatch(admin, /aiCredits\.getBalance\(userId\)/);
  assert.match(credits, /async function peekBalance\(userId\)/);
  assert.match(credits, /SELECT \* FROM "AiCreditWallet" WHERE "userId"=\$1 LIMIT 1/);
});

test('admin activity labels trial allocation and attribution as system-side events', () => {
  const activity = read('src/services/customerActivityService.js');
  assert.match(activity, /Trial AI credits allocated/);
  assert.match(activity, /Signup attribution recorded/);
  assert.match(activity, /Trial conversion attribution recorded/);
  assert.match(activity, /Internal marketing attribution event; not a customer action\./);
});

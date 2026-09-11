const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('workspace auth invalidates immediately across tabs and unauthorized API responses', () => {
  const session = read('frontend/src/lib/auth-session.ts');
  const api = read('frontend/src/lib/api-client.ts');
  const guard = read('frontend/src/components/auth/RequireAuth.tsx');

  assert.match(session, /inx-social-auth-event-v1/);
  assert.match(session, /BroadcastChannel/);
  assert.match(session, /window\.addEventListener\('storage'/);
  assert.match(session, /TOKEN_KEYS/);
  assert.match(api, /response\.status === 401/);
  assert.match(api, /invalidateAuthSession\('expired'/);
  assert.match(guard, /subscribeToAuthSession/);
  assert.match(guard, /event\.type === 'logout' \|\| event\.type === 'expired'/);
  assert.match(guard, /window\.location\.replace\(loginUrl\(\)\)/);
});

test('AI Post Studio keeps a user-scoped recoverable unfinished session', () => {
  const recovery = read('frontend/src/lib/ai-post-studio-recovery.ts');
  const studio = read('frontend/src/components/ai-content-studio/ImagePostChatModalV4.tsx');
  const router = read('frontend/src/components/ai-content-studio/ImagePostChatModal.tsx');

  assert.match(recovery, /inx-social-ai-post-recovery-v1:/);
  assert.match(recovery, /getCurrentAuthUserId/);
  assert.match(recovery, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(studio, /Unfinished work found/);
  assert.match(studio, /Resume previous work/);
  assert.match(studio, /Start new session/);
  assert.match(studio, /writePostStudioRecovery/);
  assert.match(studio, /clearPostStudioRecovery/);
  assert.match(studio, /Previous AI Post Studio session restored/);
  assert.match(router, /ImagePostChatModalV4/);
});

test('successful handoff or explicit draft save clears transient recovery', () => {
  const studio = read('frontend/src/components/ai-content-studio/ImagePostChatModalV4.tsx');
  assert.match(studio, /saveAIDraft[\s\S]*clearPostStudioRecovery/);
  assert.match(studio, /function continueToPosts\(\)[\s\S]*clearPostStudioRecovery/);
});

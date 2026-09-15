const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { pooledDatabaseUrl } = require('../src/db/databaseUrl');

test('Prisma PostgreSQL URLs receive conservative pool defaults without overriding explicit settings', () => {
  const pooled = new URL(pooledDatabaseUrl('postgresql://user:pass@db.internal:5432/app?schema=public', {
    connectionLimit: 5, poolTimeout: 20, connectTimeout: 10
  }));
  assert.equal(pooled.searchParams.get('connection_limit'), '5');
  assert.equal(pooled.searchParams.get('pool_timeout'), '20');
  assert.equal(pooled.searchParams.get('connect_timeout'), '10');
  assert.equal(pooled.searchParams.get('schema'), 'public');

  const explicit = new URL(pooledDatabaseUrl('postgresql://user:pass@db/app?connection_limit=9'));
  assert.equal(explicit.searchParams.get('connection_limit'), '9');
});

test('server drains HTTP and disconnects Prisma during Railway shutdown', () => {
  const server = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  assert.match(server, /process\.once\('SIGTERM'/);
  assert.match(server, /server\.close/);
  assert.match(server, /prisma\.\$disconnect/);
});

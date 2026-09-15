const { PrismaClient } = require('@prisma/client');
const { pooledDatabaseUrl } = require('./databaseUrl');

const prisma = new PrismaClient({
  ...(process.env.DATABASE_URL ? { datasources: { db: { url: pooledDatabaseUrl(process.env.DATABASE_URL) } } } : {}),
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

module.exports = prisma;

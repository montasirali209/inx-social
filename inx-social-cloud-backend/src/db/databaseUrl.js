function pooledDatabaseUrl(value, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return raw;
    const defaults = {
      connection_limit: String(options.connectionLimit || process.env.PRISMA_CONNECTION_LIMIT || 5),
      pool_timeout: String(options.poolTimeout || process.env.PRISMA_POOL_TIMEOUT_SECONDS || 20),
      connect_timeout: String(options.connectTimeout || process.env.PRISMA_CONNECT_TIMEOUT_SECONDS || 10)
    };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, fallback);
    }
    return parsed.toString();
  } catch (_) {
    return raw;
  }
}

module.exports = { pooledDatabaseUrl };

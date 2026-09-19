'use strict';

const prisma = require('../db/prisma');

function mb(bytes) {
  return Number((Number(bytes || 0) / (1024 * 1024)).toFixed(2));
}

async function runStorageDiagnostics() {
  if (!/^(?:1|true|yes|on)$/i.test(String(process.env.DB_STORAGE_DIAGNOSTICS_ON_STARTUP || '').trim())) return;

  try {
    const [databaseRows, relationRows, assetRows, assetTypeRows, snapshotRows, cacheRows] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT current_database() AS "database",
               pg_database_size(current_database())::bigint AS "bytes"
      `),
      prisma.$queryRawUnsafe(`
        SELECT c.relname AS "table",
               pg_total_relation_size(c.oid)::bigint AS "totalBytes",
               pg_relation_size(c.oid)::bigint AS "heapBytes",
               pg_indexes_size(c.oid)::bigint AS "indexBytes",
               CASE WHEN c.reltoastrelid <> 0
                    THEN pg_total_relation_size(c.reltoastrelid)::bigint
                    ELSE 0::bigint
               END AS "toastBytes",
               GREATEST(c.reltuples, 0)::bigint AS "estimatedRows"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'm')
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 25
      `),
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::bigint AS "count",
               COALESCE(SUM("byteSize"), 0)::bigint AS "declaredBytes",
               COALESCE(MAX("byteSize"), 0)::bigint AS "largestAssetBytes",
               COUNT(*) FILTER (WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= NOW())::bigint AS "expiredCount",
               COALESCE(SUM("byteSize") FILTER (WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()), 0)::bigint AS "expiredDeclaredBytes",
               COUNT(*) FILTER (WHERE "archivedAt" IS NOT NULL)::bigint AS "trashedCount",
               COALESCE(SUM("byteSize") FILTER (WHERE "archivedAt" IS NOT NULL), 0)::bigint AS "trashedDeclaredBytes"
        FROM "AgentAsset"
      `),
      prisma.$queryRawUnsafe(`
        SELECT CASE WHEN "mimeType" LIKE 'video/%' THEN 'video' ELSE 'other' END AS "type",
               COUNT(*)::bigint AS "count",
               COALESCE(SUM("byteSize"), 0)::bigint AS "declaredBytes"
        FROM "AgentAsset"
        GROUP BY 1
        ORDER BY "declaredBytes" DESC
      `),
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::bigint AS "count",
               MIN("capturedAt") AS "oldest",
               MAX("capturedAt") AS "newest",
               COALESCE(SUM(OCTET_LENGTH(COALESCE("metricsJson", ''))), 0)::bigint AS "metricsJsonBytes"
        FROM "AnalyticsMetricSnapshot"
      `),
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::bigint AS "count",
               COALESCE(SUM(OCTET_LENGTH(COALESCE("payloadJson", ''))), 0)::bigint AS "payloadBytes"
        FROM "AnalyticsSourceCache"
      `)
    ]);

    const db = databaseRows[0] || {};
    console.info('[DB STORAGE DIAGNOSTICS] database', {
      database: db.database,
      totalMB: mb(db.bytes)
    });

    console.info('[DB STORAGE DIAGNOSTICS] top relations',
      relationRows.map((row) => ({
        table: row.table,
        totalMB: mb(row.totalBytes),
        heapMB: mb(row.heapBytes),
        indexMB: mb(row.indexBytes),
        toastMB: mb(row.toastBytes),
        estimatedRows: Number(row.estimatedRows || 0)
      }))
    );

    const asset = assetRows[0] || {};
    console.info('[DB STORAGE DIAGNOSTICS] AgentAsset', {
      count: Number(asset.count || 0),
      declaredMB: mb(asset.declaredBytes),
      largestAssetMB: mb(asset.largestAssetBytes),
      expiredCount: Number(asset.expiredCount || 0),
      expiredDeclaredMB: mb(asset.expiredDeclaredBytes),
      trashedCount: Number(asset.trashedCount || 0),
      trashedDeclaredMB: mb(asset.trashedDeclaredBytes),
      byType: assetTypeRows.map((row) => ({
        type: row.type,
        count: Number(row.count || 0),
        declaredMB: mb(row.declaredBytes)
      }))
    });

    const snapshots = snapshotRows[0] || {};
    console.info('[DB STORAGE DIAGNOSTICS] AnalyticsMetricSnapshot', {
      count: Number(snapshots.count || 0),
      oldest: snapshots.oldest || null,
      newest: snapshots.newest || null,
      metricsJsonMB: mb(snapshots.metricsJsonBytes)
    });

    const cache = cacheRows[0] || {};
    console.info('[DB STORAGE DIAGNOSTICS] AnalyticsSourceCache', {
      count: Number(cache.count || 0),
      payloadMB: mb(cache.payloadBytes)
    });
  } catch (error) {
    console.error('[DB STORAGE DIAGNOSTICS] failed', { error: error?.message || String(error) });
  }
}

module.exports = { runStorageDiagnostics };

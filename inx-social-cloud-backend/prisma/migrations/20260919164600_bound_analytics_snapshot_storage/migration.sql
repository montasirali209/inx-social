-- Analytics charts read normalized columns, not the raw provider JSON.
-- Clear historical duplicate payloads and enforce the new 30-day window immediately.
UPDATE "AnalyticsMetricSnapshot"
SET "metricsJson" = NULL
WHERE "metricsJson" IS NOT NULL;

DELETE FROM "AnalyticsMetricSnapshot"
WHERE "capturedAt" < NOW() - INTERVAL '30 days';

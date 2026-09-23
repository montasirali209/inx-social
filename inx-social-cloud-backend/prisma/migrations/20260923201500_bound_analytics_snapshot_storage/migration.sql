-- Analytics reads normalized snapshot columns, not the duplicated raw provider JSON.
-- Keep enough history for trends while preventing analytics telemetry from growing without bound.
UPDATE "AnalyticsMetricSnapshot"
SET "metricsJson" = NULL
WHERE "metricsJson" IS NOT NULL;

DELETE FROM "AnalyticsMetricSnapshot"
WHERE "capturedAt" < NOW() - INTERVAL '30 days';

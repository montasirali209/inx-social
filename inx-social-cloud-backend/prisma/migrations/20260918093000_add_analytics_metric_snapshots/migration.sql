CREATE TABLE "AnalyticsMetricSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalPostId" TEXT NOT NULL,
    "postPublishedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "follows" INTEGER NOT NULL DEFAULT 0,
    "metricsJson" TEXT,

    CONSTRAINT "AnalyticsMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsMetricSnapshot_profileId_capturedAt_idx"
ON "AnalyticsMetricSnapshot"("profileId", "capturedAt");

CREATE INDEX "AnalyticsMetricSnapshot_profileId_externalPostId_capturedAt_idx"
ON "AnalyticsMetricSnapshot"("profileId", "externalPostId", "capturedAt");

CREATE INDEX "AnalyticsMetricSnapshot_userId_capturedAt_idx"
ON "AnalyticsMetricSnapshot"("userId", "capturedAt");

ALTER TABLE "AnalyticsMetricSnapshot"
ADD CONSTRAINT "AnalyticsMetricSnapshot_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "SocialProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

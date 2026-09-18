CREATE TABLE "AnalyticsSourceCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "cacheVariant" TEXT NOT NULL DEFAULT 'full',
    "payloadJson" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'EMPTY',
    "syncedAt" TIMESTAMP(3),
    "refreshRequestedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSourceCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsSourceCache_userId_profileId_periodDays_cacheVariant_key"
ON "AnalyticsSourceCache"("userId", "profileId", "periodDays", "cacheVariant");

CREATE INDEX "AnalyticsSourceCache_profileId_syncedAt_idx"
ON "AnalyticsSourceCache"("profileId", "syncedAt");

CREATE INDEX "AnalyticsSourceCache_userId_updatedAt_idx"
ON "AnalyticsSourceCache"("userId", "updatedAt");

CREATE INDEX "AnalyticsSourceCache_syncStatus_refreshRequestedAt_idx"
ON "AnalyticsSourceCache"("syncStatus", "refreshRequestedAt");

ALTER TABLE "AnalyticsSourceCache"
ADD CONSTRAINT "AnalyticsSourceCache_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "SocialProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

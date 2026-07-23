-- Phase 10.0: additive cloud studio and worker-ready queue foundation.
ALTER TABLE "ScheduleJob"
ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'DESKTOP',
ADD COLUMN "uploadStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "publishMode" TEXT NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "clientRequestId" TEXT,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "CloudAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scheduleJobId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  "storageKey" TEXT,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSizeBytes" BIGINT,
  "sha256" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AWAITING_UPLOAD',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleJob_userId_clientRequestId_key"
ON "ScheduleJob"("userId", "clientRequestId");
CREATE INDEX "ScheduleJob_origin_idx" ON "ScheduleJob"("origin");
CREATE INDEX "ScheduleJob_uploadStatus_idx" ON "ScheduleJob"("uploadStatus");
CREATE INDEX "ScheduleJob_nextAttemptAt_idx" ON "ScheduleJob"("nextAttemptAt");

CREATE UNIQUE INDEX "CloudAsset_scheduleJobId_key" ON "CloudAsset"("scheduleJobId");
CREATE UNIQUE INDEX "CloudAsset_storageKey_key" ON "CloudAsset"("storageKey");
CREATE INDEX "CloudAsset_userId_idx" ON "CloudAsset"("userId");
CREATE INDEX "CloudAsset_status_idx" ON "CloudAsset"("status");
CREATE INDEX "CloudAsset_expiresAt_idx" ON "CloudAsset"("expiresAt");

ALTER TABLE "CloudAsset"
ADD CONSTRAINT "CloudAsset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CloudAsset"
ADD CONSTRAINT "CloudAsset_scheduleJobId_fkey"
FOREIGN KEY ("scheduleJobId") REFERENCES "ScheduleJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CloudPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "settingsJson" TEXT,
  "uiTextsJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudPreference_userId_key" ON "CloudPreference"("userId");
CREATE INDEX "CloudPreference_userId_idx" ON "CloudPreference"("userId");

ALTER TABLE "CloudPreference"
ADD CONSTRAINT "CloudPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

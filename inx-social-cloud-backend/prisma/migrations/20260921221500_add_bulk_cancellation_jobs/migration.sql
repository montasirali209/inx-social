CREATE TABLE "BulkCancellationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicationIdsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "requestedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "resultJson" TEXT,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkCancellationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkCancellationJob_userId_createdAt_idx" ON "BulkCancellationJob"("userId", "createdAt");
CREATE INDEX "BulkCancellationJob_status_createdAt_idx" ON "BulkCancellationJob"("status", "createdAt");

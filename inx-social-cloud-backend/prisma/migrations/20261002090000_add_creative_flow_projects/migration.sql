-- Creative Flow project shell. This migration is intentionally additive:
-- no existing campaign, scheduler, billing or publishing tables are changed.
CREATE TABLE "CreativeFlowProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentStage" TEXT NOT NULL DEFAULT 'PROJECT_CREATED',
    "activeJobType" TEXT,
    "activeJobId" TEXT,
    "activeJobStartedAt" TIMESTAMP(3),
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "progressLabel" TEXT,
    "productUrl" TEXT,
    "workflowJson" TEXT,
    "renderCampaignId" TEXT,
    "handoffCampaignId" TEXT,
    "lastError" TEXT,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeFlowProject_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreativeFlowProject"
ADD CONSTRAINT "CreativeFlowProject_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CreativeFlowProject_userId_updatedAt_idx"
ON "CreativeFlowProject"("userId", "updatedAt");

CREATE INDEX "CreativeFlowProject_userId_status_idx"
ON "CreativeFlowProject"("userId", "status");

CREATE INDEX "CreativeFlowProject_activeJobType_idx"
ON "CreativeFlowProject"("activeJobType");

CREATE INDEX "CreativeFlowProject_renderCampaignId_idx"
ON "CreativeFlowProject"("renderCampaignId");

CREATE INDEX "CreativeFlowProject_handoffCampaignId_idx"
ON "CreativeFlowProject"("handoffCampaignId");

-- Database-level concurrency guard: a user may save many projects,
-- but only one project may own a running Creative Flow AI job at a time.
CREATE UNIQUE INDEX "CreativeFlowProject_one_active_job_per_user"
ON "CreativeFlowProject"("userId")
WHERE "activeJobType" IS NOT NULL AND "archivedAt" IS NULL;

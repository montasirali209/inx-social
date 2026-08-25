-- Phase 11.5.0: persistent campaign review, per-post approval and governed scheduling.
CREATE TABLE "AgentCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "targetPageIdsJson" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "researchSummary" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentCampaignPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "connectedPageId" TEXT,
    "assetId" TEXT,
    "scheduleJobId" TEXT,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_REVIEW',
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "format" TEXT NOT NULL DEFAULT 'IMAGE',
    "title" TEXT,
    "caption" TEXT NOT NULL,
    "altText" TEXT,
    "hashtagsJson" TEXT,
    "visualBrief" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "scheduleReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metaPostId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentCampaignPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentCampaign_planId_key" ON "AgentCampaign"("planId");
CREATE INDEX "AgentCampaign_userId_createdAt_idx" ON "AgentCampaign"("userId", "createdAt");
CREATE INDEX "AgentCampaign_status_idx" ON "AgentCampaign"("status");
CREATE UNIQUE INDEX "AgentCampaignPost_scheduleJobId_key" ON "AgentCampaignPost"("scheduleJobId");
CREATE UNIQUE INDEX "AgentCampaignPost_campaignId_sequence_key" ON "AgentCampaignPost"("campaignId", "sequence");
CREATE INDEX "AgentCampaignPost_campaignId_status_idx" ON "AgentCampaignPost"("campaignId", "status");
CREATE INDEX "AgentCampaignPost_connectedPageId_idx" ON "AgentCampaignPost"("connectedPageId");
CREATE INDEX "AgentCampaignPost_assetId_idx" ON "AgentCampaignPost"("assetId");
CREATE INDEX "AgentCampaignPost_scheduledAt_idx" ON "AgentCampaignPost"("scheduledAt");

ALTER TABLE "AgentCampaign" ADD CONSTRAINT "AgentCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCampaign" ADD CONSTRAINT "AgentCampaign_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AgentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCampaignPost" ADD CONSTRAINT "AgentCampaignPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AgentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCampaignPost" ADD CONSTRAINT "AgentCampaignPost_connectedPageId_fkey" FOREIGN KEY ("connectedPageId") REFERENCES "ConnectedPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentCampaignPost" ADD CONSTRAINT "AgentCampaignPost_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AgentAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentCampaignPost" ADD CONSTRAINT "AgentCampaignPost_scheduleJobId_fkey" FOREIGN KEY ("scheduleJobId") REFERENCES "ScheduleJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

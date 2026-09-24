CREATE TABLE IF NOT EXISTS "UGCEngineProject" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "fingerprint" TEXT NOT NULL,
  "briefJson" TEXT NOT NULL DEFAULT '{}',
  "actorJson" TEXT NOT NULL DEFAULT '{}',
  "productionPlanJson" TEXT NOT NULL DEFAULT '{}',
  "routeDecisionJson" TEXT NOT NULL DEFAULT '{}',
  "pricingJson" TEXT NOT NULL DEFAULT '{}',
  "renderJobsJson" TEXT NOT NULL DEFAULT '[]',
  "qcJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCEngineProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCEngineProject_campaignId_key" UNIQUE ("campaignId"),
  CONSTRAINT "UGCEngineProject_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "UGCCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCEngineProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UGCEngineProject_userId_updatedAt_idx" ON "UGCEngineProject"("userId","updatedAt");
CREATE INDEX IF NOT EXISTS "UGCEngineProject_status_updatedAt_idx" ON "UGCEngineProject"("status","updatedAt");
CREATE INDEX IF NOT EXISTS "UGCEngineProject_engineVersion_idx" ON "UGCEngineProject"("engineVersion");

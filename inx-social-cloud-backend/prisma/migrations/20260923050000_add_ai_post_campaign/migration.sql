CREATE TABLE "AiPostCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "businessUrl" TEXT,
    "goal" TEXT NOT NULL,
    "audience" TEXT,
    "tone" TEXT,
    "contentMode" TEXT NOT NULL DEFAULT 'TEXT',
    "platformsJson" TEXT NOT NULL DEFAULT '[]',
    "postCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "analysisJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiPostCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiPostCampaignPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "title" TEXT NOT NULL,
    "pillar" TEXT,
    "hook" TEXT,
    "caption" TEXT NOT NULL,
    "cta" TEXT,
    "hashtagsJson" TEXT NOT NULL DEFAULT '[]',
    "imageBrief" TEXT,
    "mediaAssetId" TEXT,
    "mediaAssetJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiPostCampaignPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiPostCampaign_userId_createdAt_idx" ON "AiPostCampaign"("userId", "createdAt");
CREATE INDEX "AiPostCampaign_status_idx" ON "AiPostCampaign"("status");
CREATE INDEX "AiPostCampaignPost_campaignId_status_idx" ON "AiPostCampaignPost"("campaignId", "status");
CREATE UNIQUE INDEX "AiPostCampaignPost_campaignId_sequence_key" ON "AiPostCampaignPost"("campaignId", "sequence");

ALTER TABLE "AiPostCampaign"
ADD CONSTRAINT "AiPostCampaign_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiPostCampaignPost"
ADD CONSTRAINT "AiPostCampaignPost_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "AiPostCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

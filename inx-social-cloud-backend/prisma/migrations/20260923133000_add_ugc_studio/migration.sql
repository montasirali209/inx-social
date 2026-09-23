CREATE TABLE "UGCBrandProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "productName" TEXT,
  "summary" TEXT,
  "audienceJson" TEXT NOT NULL DEFAULT '[]',
  "verifiedClaimsJson" TEXT NOT NULL DEFAULT '[]',
  "brandReferencesJson" TEXT NOT NULL DEFAULT '[]',
  "analysisJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCBrandProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCBrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UGCAvatar" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'SYSTEM',
  "slug" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Lifestyle',
  "presentation" TEXT,
  "ageBand" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en-GB',
  "voice" TEXT NOT NULL DEFAULT 'Aoede (Female)',
  "voicePrompt" TEXT NOT NULL DEFAULT 'Natural, warm, conversational social creator delivery.',
  "prompt" TEXT NOT NULL,
  "referenceStorageProvider" TEXT,
  "referenceStorageKey" TEXT,
  "referenceMimeType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCAvatar_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UGCCampaign" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "brandProfileId" TEXT,
  "title" TEXT NOT NULL,
  "productUrl" TEXT,
  "productDescription" TEXT,
  "duration" INTEGER NOT NULL,
  "adCount" INTEGER NOT NULL,
  "quality" TEXT NOT NULL DEFAULT 'STANDARD',
  "creatorMode" TEXT NOT NULL DEFAULT 'AUTO',
  "selectedAvatarId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNING',
  "totalCredits" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "planJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "UGCCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCCampaign_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "UGCBrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UGCCampaign_selectedAvatarId_fkey" FOREIGN KEY ("selectedAvatarId") REFERENCES "UGCAvatar"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "UGCAd" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "title" TEXT NOT NULL,
  "angle" TEXT,
  "hook" TEXT,
  "script" TEXT NOT NULL,
  "cta" TEXT,
  "caption" TEXT,
  "avatarId" TEXT,
  "route" TEXT NOT NULL DEFAULT 'PVIDEO2',
  "voice" TEXT,
  "voicePrompt" TEXT,
  "duration" INTEGER NOT NULL,
  "quality" TEXT NOT NULL DEFAULT 'STANDARD',
  "credits" INTEGER NOT NULL DEFAULT 0,
  "generationId" TEXT,
  "mediaAssetId" TEXT,
  "musicMode" TEXT NOT NULL DEFAULT 'AUTO',
  "captionsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "planJson" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "UGCAd_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCAd_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "UGCCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCAd_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "UGCAvatar"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UGCAd_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UGCAd_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "AgentAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "UGCScene" (
  "id" TEXT NOT NULL,
  "adId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "kind" TEXT NOT NULL DEFAULT 'CREATOR',
  "route" TEXT NOT NULL DEFAULT 'PVIDEO2',
  "duration" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "script" TEXT,
  "avatarId" TEXT,
  "productReferenceJson" TEXT NOT NULL DEFAULT '[]',
  "providerTaskUuid" TEXT,
  "providerCostUsd" DECIMAL(12,6),
  "model" TEXT,
  "videoStorageProvider" TEXT,
  "videoStorageKey" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCScene_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCScene_adId_fkey" FOREIGN KEY ("adId") REFERENCES "UGCAd"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCScene_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "UGCAvatar"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "UGCMusicTrack" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "storageProvider" TEXT,
  "storageKey" TEXT,
  "durationSeconds" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCMusicTrack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UGCAvatar_slug_key" ON "UGCAvatar"("slug");
CREATE INDEX "UGCBrandProfile_userId_updatedAt_idx" ON "UGCBrandProfile"("userId","updatedAt");
CREATE INDEX "UGCAvatar_scope_userId_idx" ON "UGCAvatar"("scope","userId");
CREATE INDEX "UGCCampaign_userId_updatedAt_idx" ON "UGCCampaign"("userId","updatedAt");
CREATE INDEX "UGCCampaign_status_createdAt_idx" ON "UGCCampaign"("status","createdAt");
CREATE UNIQUE INDEX "UGCAd_campaignId_sequence_key" ON "UGCAd"("campaignId","sequence");
CREATE INDEX "UGCAd_userId_status_idx" ON "UGCAd"("userId","status");
CREATE INDEX "UGCAd_status_createdAt_idx" ON "UGCAd"("status","createdAt");
CREATE UNIQUE INDEX "UGCScene_adId_sequence_key" ON "UGCScene"("adId","sequence");
CREATE INDEX "UGCScene_adId_status_idx" ON "UGCScene"("adId","status");
CREATE INDEX "UGCMusicTrack_active_category_idx" ON "UGCMusicTrack"("active","category");

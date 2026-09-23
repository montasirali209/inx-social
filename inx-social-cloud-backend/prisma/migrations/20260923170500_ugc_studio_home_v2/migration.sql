ALTER TABLE "UGCCampaign"
  ADD COLUMN IF NOT EXISTS "campaignType" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS "resolvedType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN IF NOT EXISTS "productAssetIdsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "UGCAvatar"
  ADD COLUMN IF NOT EXISTS "environment" TEXT,
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "referenceVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "UGCProductAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "brandProfileId" TEXT,
  "originalName" TEXT,
  "mimeType" TEXT NOT NULL,
  "storageProvider" TEXT,
  "storageKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCProductAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCProductAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UGCProductAsset_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "UGCBrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UGCSampleVideo" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "campaignType" TEXT NOT NULL DEFAULT 'AVATAR_EXPLAINER',
  "quality" TEXT NOT NULL DEFAULT 'STANDARD',
  "duration" INTEGER NOT NULL DEFAULT 15,
  "storageProvider" TEXT,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
  "thumbnailUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCSampleVideo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCSampleVideo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UGCCampaign_userId_deletedAt_updatedAt_idx" ON "UGCCampaign"("userId","deletedAt","updatedAt");
CREATE INDEX IF NOT EXISTS "UGCProductAsset_userId_createdAt_idx" ON "UGCProductAsset"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "UGCProductAsset_brandProfileId_idx" ON "UGCProductAsset"("brandProfileId");
CREATE INDEX IF NOT EXISTS "UGCSampleVideo_active_sortOrder_idx" ON "UGCSampleVideo"("active","sortOrder");
CREATE INDEX IF NOT EXISTS "UGCAvatar_featured_scope_idx" ON "UGCAvatar"("featured","scope");

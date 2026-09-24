ALTER TABLE "UGCAvatar"
  ADD COLUMN IF NOT EXISTS "creatorVersion" TEXT NOT NULL DEFAULT 'ugc-creators-v2',
  ADD COLUMN IF NOT EXISTS "accent" TEXT,
  ADD COLUMN IF NOT EXISTS "languagesJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "nichesJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "environmentTagsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "wardrobeJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "gestureJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "routeCompatibilityJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "castingProfileJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "referenceQualityStatus" TEXT NOT NULL DEFAULT 'UNASSESSED',
  ADD COLUMN IF NOT EXISTS "referenceQualityScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "referenceReviewedAt" TIMESTAMP(3);

UPDATE "UGCAvatar"
SET "referenceQualityStatus" = CASE WHEN "referenceStorageKey" IS NULL THEN 'PENDING' ELSE 'READY' END,
    "referenceQualityScore" = CASE WHEN "referenceStorageKey" IS NULL THEN 0 ELSE 100 END,
    "referenceReviewedAt" = CASE WHEN "referenceStorageKey" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
WHERE "referenceQualityStatus" = 'UNASSESSED';

CREATE TABLE IF NOT EXISTS "UGCAvatarReference" (
  "id" TEXT NOT NULL,
  "avatarId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ALTERNATE',
  "label" TEXT,
  "storageProvider" TEXT,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'image/png',
  "source" TEXT NOT NULL DEFAULT 'UPLOAD',
  "qualityStatus" TEXT NOT NULL DEFAULT 'READY',
  "qualityScore" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCAvatarReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCAvatarReference_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "UGCAvatar"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UGCAvatar_creatorVersion_scope_idx" ON "UGCAvatar"("creatorVersion","scope");
CREATE INDEX IF NOT EXISTS "UGCAvatar_referenceQualityStatus_idx" ON "UGCAvatar"("referenceQualityStatus");
CREATE INDEX IF NOT EXISTS "UGCAvatarReference_avatarId_active_sortOrder_idx" ON "UGCAvatarReference"("avatarId","active","sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "UGCAvatarReference_avatarId_storageKey_key" ON "UGCAvatarReference"("avatarId","storageKey");

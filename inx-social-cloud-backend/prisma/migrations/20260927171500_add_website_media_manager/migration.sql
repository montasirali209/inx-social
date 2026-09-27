-- Website Media Manager foundation.
-- Stores durable public marketing-image slots and immutable uploaded versions.
CREATE TABLE "WebsiteMediaAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "altText" TEXT,
    "recommendedMinWidth" INTEGER,
    "recommendedMinHeight" INTEGER,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteMediaVersion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteMediaVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteMediaAsset_key_key" ON "WebsiteMediaAsset"("key");
CREATE INDEX "WebsiteMediaAsset_section_idx" ON "WebsiteMediaAsset"("section");
CREATE INDEX "WebsiteMediaAsset_updatedAt_idx" ON "WebsiteMediaAsset"("updatedAt");

CREATE UNIQUE INDEX "WebsiteMediaVersion_storageKey_key" ON "WebsiteMediaVersion"("storageKey");
CREATE INDEX "WebsiteMediaVersion_assetId_createdAt_idx" ON "WebsiteMediaVersion"("assetId", "createdAt");
CREATE INDEX "WebsiteMediaVersion_createdAt_idx" ON "WebsiteMediaVersion"("createdAt");

ALTER TABLE "WebsiteMediaVersion"
ADD CONSTRAINT "WebsiteMediaVersion_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "WebsiteMediaAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteMediaAsset"
ADD CONSTRAINT "WebsiteMediaAsset_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "WebsiteMediaVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

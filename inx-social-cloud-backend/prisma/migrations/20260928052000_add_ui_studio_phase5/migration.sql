-- UI Studio Phase 5: deterministic render queue, convergence, assets, masks and accepted/best versions.

ALTER TABLE "UiDesignProject"
  ADD COLUMN "bestGenerationId" TEXT,
  ADD COLUMN "acceptedGenerationId" TEXT,
  ADD COLUMN "bestAggregateScore" DOUBLE PRECISION,
  ADD COLUMN "acceptedAt" TIMESTAMP(3);

ALTER TABLE "UiDesignGeneration"
  ADD COLUMN "parentGenerationId" TEXT,
  ADD COLUMN "repairDepth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aggregateScore" DOUBLE PRECISION,
  ADD COLUMN "viewportScoresJson" TEXT,
  ADD COLUMN "qualityStatus" TEXT;

ALTER TABLE "UiDesignRender"
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "workerId" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "autoRepair" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "startedAt" TIMESTAMP(3);

CREATE TABLE "UiDesignAssetBinding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slotName" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "viewport" TEXT NOT NULL DEFAULT 'ALL',
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UiDesignAssetBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UiDesignIgnoreMask" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "viewport" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "xPct" DOUBLE PRECISION NOT NULL,
  "yPct" DOUBLE PRECISION NOT NULL,
  "widthPct" DOUBLE PRECISION NOT NULL,
  "heightPct" DOUBLE PRECISION NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UiDesignIgnoreMask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UiDesignAssetBinding_storageKey_key" ON "UiDesignAssetBinding"("storageKey");
CREATE UNIQUE INDEX "UiDesignAssetBinding_projectId_slotName_viewport_key" ON "UiDesignAssetBinding"("projectId","slotName","viewport");
CREATE INDEX "UiDesignAssetBinding_projectId_idx" ON "UiDesignAssetBinding"("projectId");
CREATE INDEX "UiDesignIgnoreMask_projectId_viewport_idx" ON "UiDesignIgnoreMask"("projectId","viewport");
CREATE INDEX "UiDesignRender_batchId_idx" ON "UiDesignRender"("batchId");
CREATE INDEX "UiDesignRender_status_leaseExpiresAt_idx" ON "UiDesignRender"("status","leaseExpiresAt");
CREATE INDEX "UiDesignGeneration_parentGenerationId_idx" ON "UiDesignGeneration"("parentGenerationId");
CREATE INDEX "UiDesignGeneration_projectId_aggregateScore_idx" ON "UiDesignGeneration"("projectId","aggregateScore");

ALTER TABLE "UiDesignAssetBinding"
  ADD CONSTRAINT "UiDesignAssetBinding_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignIgnoreMask"
  ADD CONSTRAINT "UiDesignIgnoreMask_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

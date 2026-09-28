-- UI Studio Phase 4: isolated visual preview, comparison and repair history.
CREATE TABLE "UiDesignRender" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "parentRenderId" TEXT,
    "viewport" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "version" TEXT NOT NULL DEFAULT 'ui-visual-v1',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceWidth" INTEGER NOT NULL,
    "sourceHeight" INTEGER NOT NULL,
    "sourceScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "repairDepth" INTEGER NOT NULL DEFAULT 0,
    "previewStorageProvider" TEXT,
    "previewStorageKey" TEXT,
    "previewSha256" TEXT,
    "renderedStorageProvider" TEXT,
    "renderedStorageKey" TEXT,
    "diffStorageProvider" TEXT,
    "diffStorageKey" TEXT,
    "metricsJson" TEXT,
    "critiqueJson" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiDesignRender_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UiDesignRepairAttempt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "renderId" TEXT NOT NULL,
    "inputGenerationId" TEXT NOT NULL,
    "outputGenerationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "scoreBefore" DOUBLE PRECISION,
    "scoreAfter" DOUBLE PRECISION,
    "instructionsJson" TEXT,
    "createdByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiDesignRepairAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiDesignRender_projectId_createdAt_idx" ON "UiDesignRender"("projectId", "createdAt");
CREATE INDEX "UiDesignRender_generationId_createdAt_idx" ON "UiDesignRender"("generationId", "createdAt");
CREATE INDEX "UiDesignRender_referenceId_idx" ON "UiDesignRender"("referenceId");
CREATE INDEX "UiDesignRender_status_createdAt_idx" ON "UiDesignRender"("status", "createdAt");
CREATE INDEX "UiDesignRender_parentRenderId_idx" ON "UiDesignRender"("parentRenderId");

CREATE INDEX "UiDesignRepairAttempt_projectId_createdAt_idx" ON "UiDesignRepairAttempt"("projectId", "createdAt");
CREATE INDEX "UiDesignRepairAttempt_renderId_idx" ON "UiDesignRepairAttempt"("renderId");
CREATE INDEX "UiDesignRepairAttempt_outputGenerationId_idx" ON "UiDesignRepairAttempt"("outputGenerationId");

ALTER TABLE "UiDesignRender"
ADD CONSTRAINT "UiDesignRender_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignRender"
ADD CONSTRAINT "UiDesignRender_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "UiDesignGeneration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignRender"
ADD CONSTRAINT "UiDesignRender_referenceId_fkey"
FOREIGN KEY ("referenceId") REFERENCES "UiDesignReference"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignRepairAttempt"
ADD CONSTRAINT "UiDesignRepairAttempt_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignRepairAttempt"
ADD CONSTRAINT "UiDesignRepairAttempt_renderId_fkey"
FOREIGN KEY ("renderId") REFERENCES "UiDesignRender"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

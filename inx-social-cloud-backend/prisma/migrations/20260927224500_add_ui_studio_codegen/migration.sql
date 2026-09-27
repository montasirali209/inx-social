-- UI Studio Phase 3: versioned responsive code generations.
CREATE TABLE "UiDesignGeneration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceAnalysisId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "version" TEXT NOT NULL DEFAULT 'ui-codegen-v1',
    "model" TEXT,
    "framework" TEXT NOT NULL,
    "styling" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "generationJson" TEXT,
    "validationJson" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiDesignGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiDesignGeneration_projectId_createdAt_idx" ON "UiDesignGeneration"("projectId", "createdAt");
CREATE INDEX "UiDesignGeneration_sourceAnalysisId_idx" ON "UiDesignGeneration"("sourceAnalysisId");
CREATE INDEX "UiDesignGeneration_status_createdAt_idx" ON "UiDesignGeneration"("status", "createdAt");
CREATE INDEX "UiDesignGeneration_sourceFingerprint_idx" ON "UiDesignGeneration"("sourceFingerprint");

ALTER TABLE "UiDesignGeneration"
ADD CONSTRAINT "UiDesignGeneration_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignGeneration"
ADD CONSTRAINT "UiDesignGeneration_sourceAnalysisId_fkey"
FOREIGN KEY ("sourceAnalysisId") REFERENCES "UiDesignAnalysis"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

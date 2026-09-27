-- UI Studio Phase 2: persisted structured design analysis.
CREATE TABLE "UiDesignAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "version" TEXT NOT NULL DEFAULT 'ui-analysis-v1',
    "model" TEXT,
    "sourceFingerprint" TEXT NOT NULL,
    "sourceReferencesJson" TEXT NOT NULL,
    "analysisJson" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiDesignAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiDesignAnalysis_projectId_createdAt_idx" ON "UiDesignAnalysis"("projectId", "createdAt");
CREATE INDEX "UiDesignAnalysis_status_createdAt_idx" ON "UiDesignAnalysis"("status", "createdAt");
CREATE INDEX "UiDesignAnalysis_sourceFingerprint_idx" ON "UiDesignAnalysis"("sourceFingerprint");

ALTER TABLE "UiDesignAnalysis"
ADD CONSTRAINT "UiDesignAnalysis_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

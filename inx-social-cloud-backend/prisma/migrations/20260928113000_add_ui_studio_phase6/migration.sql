-- UI Studio Phase 6 delivery layer: immutable exports, repository mapping,
-- regression evidence, pull-request review and explicit deployment approval.

CREATE TABLE "UiDesignDelivery" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'ui-delivery-v1',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "targetMode" TEXT NOT NULL DEFAULT 'EXPORT_ONLY',
  "repository" TEXT,
  "baseBranch" TEXT,
  "targetDirectory" TEXT,
  "branchName" TEXT,
  "pullRequestNumber" INTEGER,
  "pullRequestUrl" TEXT,
  "commitSha" TEXT,
  "mergeSha" TEXT,
  "mappingJson" TEXT NOT NULL DEFAULT '[]',
  "regressionJson" TEXT,
  "artifactStorageProvider" TEXT,
  "artifactStorageKey" TEXT,
  "artifactFileName" TEXT,
  "artifactByteSize" BIGINT,
  "artifactSha256" TEXT,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "deploymentTriggeredAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UiDesignDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UiDesignDelivery_artifactStorageKey_key" ON "UiDesignDelivery"("artifactStorageKey");
CREATE INDEX "UiDesignDelivery_projectId_createdAt_idx" ON "UiDesignDelivery"("projectId", "createdAt");
CREATE INDEX "UiDesignDelivery_generationId_idx" ON "UiDesignDelivery"("generationId");
CREATE INDEX "UiDesignDelivery_status_createdAt_idx" ON "UiDesignDelivery"("status", "createdAt");
CREATE INDEX "UiDesignDelivery_repository_pullRequestNumber_idx" ON "UiDesignDelivery"("repository", "pullRequestNumber");

ALTER TABLE "UiDesignDelivery"
ADD CONSTRAINT "UiDesignDelivery_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UiDesignDelivery"
ADD CONSTRAINT "UiDesignDelivery_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "UiDesignGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

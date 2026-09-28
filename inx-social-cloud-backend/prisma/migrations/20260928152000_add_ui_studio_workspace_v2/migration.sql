-- UI Studio Workspace v2:
-- multi-target project configuration, explicit production-code finalization
-- and project-aware AI assistant message history.

ALTER TABLE "UiDesignProject"
  ADD COLUMN "frameworkTargetsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "stylingTargetsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "productionGenerationId" TEXT,
  ADD COLUMN "productionGeneratedAt" TIMESTAMP(3);

CREATE TABLE "UiDesignAgentMessage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "actionJson" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UiDesignAgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiDesignAgentMessage_projectId_createdAt_idx"
  ON "UiDesignAgentMessage"("projectId", "createdAt");

ALTER TABLE "UiDesignAgentMessage"
  ADD CONSTRAINT "UiDesignAgentMessage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

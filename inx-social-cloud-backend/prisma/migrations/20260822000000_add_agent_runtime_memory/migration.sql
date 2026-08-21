-- Phase 11.1: operational Social Agent runtime, live events and persistent working memory.
ALTER TABLE "AgentPlan"
ADD COLUMN "operationMode" TEXT NOT NULL DEFAULT 'HYBRID',
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;

ALTER TABLE "AgentTask"
ADD COLUMN "outputJson" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "AgentMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pageId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'AGENT',
  "confidence" INTEGER NOT NULL DEFAULT 80,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT,
  "taskId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentMemory_userId_idx" ON "AgentMemory"("userId");
CREATE INDEX "AgentMemory_pageId_idx" ON "AgentMemory"("pageId");
CREATE INDEX "AgentMemory_category_idx" ON "AgentMemory"("category");
CREATE INDEX "AgentMemory_updatedAt_idx" ON "AgentMemory"("updatedAt");
CREATE INDEX "AgentEvent_userId_idx" ON "AgentEvent"("userId");
CREATE INDEX "AgentEvent_planId_idx" ON "AgentEvent"("planId");
CREATE INDEX "AgentEvent_taskId_idx" ON "AgentEvent"("taskId");
CREATE INDEX "AgentEvent_createdAt_idx" ON "AgentEvent"("createdAt");

ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AgentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

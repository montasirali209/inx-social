-- Phase 11.0: approval-first Social Agent planning foundation.
CREATE TABLE "AgentPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL',
    "platformsJson" TEXT NOT NULL,
    "strategyJson" TEXT NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "platform" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "executionMode" TEXT NOT NULL DEFAULT 'INX_TEMPLATE',
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentPlan_userId_idx" ON "AgentPlan"("userId");
CREATE INDEX "AgentPlan_status_idx" ON "AgentPlan"("status");
CREATE INDEX "AgentPlan_createdAt_idx" ON "AgentPlan"("createdAt");
CREATE UNIQUE INDEX "AgentTask_planId_sequence_key" ON "AgentTask"("planId", "sequence");
CREATE INDEX "AgentTask_planId_idx" ON "AgentTask"("planId");
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");
CREATE INDEX "AgentTask_type_idx" ON "AgentTask"("type");

ALTER TABLE "AgentPlan"
ADD CONSTRAINT "AgentPlan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTask"
ADD CONSTRAINT "AgentTask_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "AgentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

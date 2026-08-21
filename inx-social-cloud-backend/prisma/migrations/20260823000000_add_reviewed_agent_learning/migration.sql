ALTER TABLE "AgentMemory"
ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN "importance" TEXT NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "AgentMemory_approvalStatus_idx" ON "AgentMemory"("approvalStatus");
CREATE INDEX "AgentMemory_importance_idx" ON "AgentMemory"("importance");

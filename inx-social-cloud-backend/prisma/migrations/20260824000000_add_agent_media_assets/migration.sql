CREATE TABLE "AgentAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'UPLOAD',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "originalName" TEXT,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "prompt" TEXT,
  "data" BYTEA NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentAsset_userId_createdAt_idx" ON "AgentAsset"("userId", "createdAt");
CREATE INDEX "AgentAsset_planId_idx" ON "AgentAsset"("planId");
CREATE INDEX "AgentAsset_checksum_idx" ON "AgentAsset"("checksum");
CREATE INDEX "AgentAsset_expiresAt_idx" ON "AgentAsset"("expiresAt");
ALTER TABLE "AgentAsset" ADD CONSTRAINT "AgentAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAsset" ADD CONSTRAINT "AgentAsset_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AgentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

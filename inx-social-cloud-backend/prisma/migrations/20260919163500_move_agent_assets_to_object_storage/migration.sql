ALTER TABLE "AgentAsset"
  ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'DATABASE',
  ADD COLUMN "storageKey" TEXT;

CREATE UNIQUE INDEX "AgentAsset_storageKey_key" ON "AgentAsset"("storageKey");
CREATE INDEX "AgentAsset_storageProvider_idx" ON "AgentAsset"("storageProvider");

ALTER TABLE "AgentAsset"
  ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "storageKey" TEXT;

CREATE UNIQUE INDEX "AgentAsset_storageKey_key" ON "AgentAsset"("storageKey");

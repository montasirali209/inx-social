ALTER TABLE "UGCEngineProject"
  ADD COLUMN IF NOT EXISTS "routerVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "routerJson" TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "UGCEngineProject_routerVersion_idx" ON "UGCEngineProject"("routerVersion");

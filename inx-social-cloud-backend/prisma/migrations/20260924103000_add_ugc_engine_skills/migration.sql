ALTER TABLE "UGCEngineProject"
  ADD COLUMN IF NOT EXISTS "skillsVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "skillsJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "preflightJson" TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "UGCEngineProject_skillsVersion_idx" ON "UGCEngineProject"("skillsVersion");

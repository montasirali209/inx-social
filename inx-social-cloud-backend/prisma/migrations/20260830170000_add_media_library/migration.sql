ALTER TABLE "AgentAsset"
  ADD COLUMN "folderId" TEXT,
  ADD COLUMN "tagsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "MediaFolder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaFolder_userId_name_key" ON "MediaFolder"("userId", "name");
CREATE INDEX "MediaFolder_userId_createdAt_idx" ON "MediaFolder"("userId", "createdAt");
CREATE INDEX "AgentAsset_folderId_idx" ON "AgentAsset"("folderId");
CREATE INDEX "AgentAsset_userId_status_source_idx" ON "AgentAsset"("userId", "status", "source");

ALTER TABLE "AgentAsset" ADD CONSTRAINT "AgentAsset_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MediaFolder" ADD CONSTRAINT "MediaFolder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

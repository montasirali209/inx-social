ALTER TABLE "ScheduleJob" ADD COLUMN "mediaLibraryAssetId" TEXT;

CREATE INDEX "ScheduleJob_mediaLibraryAssetId_idx" ON "ScheduleJob"("mediaLibraryAssetId");

ALTER TABLE "ScheduleJob" ADD CONSTRAINT "ScheduleJob_mediaLibraryAssetId_fkey"
FOREIGN KEY ("mediaLibraryAssetId") REFERENCES "AgentAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

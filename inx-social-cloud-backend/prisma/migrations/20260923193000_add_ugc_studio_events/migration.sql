CREATE TABLE IF NOT EXISTS "UGCStudioEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "stage" TEXT,
  "campaignId" TEXT,
  "adId" TEXT,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UGCStudioEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UGCStudioEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UGCStudioEvent_createdAt_idx" ON "UGCStudioEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "UGCStudioEvent_event_createdAt_idx" ON "UGCStudioEvent"("event","createdAt");
CREATE INDEX IF NOT EXISTS "UGCStudioEvent_userId_createdAt_idx" ON "UGCStudioEvent"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "UGCStudioEvent_campaignId_idx" ON "UGCStudioEvent"("campaignId");

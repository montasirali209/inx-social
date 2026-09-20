CREATE TABLE "SearchConsoleConnection" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'google',
  "connectedByUserId" TEXT,
  "encryptedAccessToken" TEXT,
  "encryptedRefreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopesJson" TEXT,
  "selectedSiteUrl" TEXT,
  "availableSitesJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SearchConsoleConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchConsoleConnection_status_idx" ON "SearchConsoleConnection"("status");
CREATE INDEX "SearchConsoleConnection_updatedAt_idx" ON "SearchConsoleConnection"("updatedAt");

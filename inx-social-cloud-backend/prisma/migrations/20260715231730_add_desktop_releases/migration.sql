-- CreateTable
CREATE TABLE "DesktopRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "minimumSupportedVersion" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopRelease_version_key" ON "DesktopRelease"("version");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopRelease_storageKey_key" ON "DesktopRelease"("storageKey");

-- CreateIndex
CREATE INDEX "DesktopRelease_active_publishedAt_idx" ON "DesktopRelease"("active", "publishedAt");

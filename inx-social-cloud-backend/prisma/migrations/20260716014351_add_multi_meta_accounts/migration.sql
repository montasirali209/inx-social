-- AlterTable
ALTER TABLE "ConnectedPage" ADD COLUMN     "facebookCategory" TEXT,
ADD COLUMN     "facebookPagePicture" TEXT,
ADD COLUMN     "facebookPageUsername" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "metaAccountId" TEXT;

-- CreateTable
CREATE TABLE "MetaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facebookUserId" TEXT NOT NULL,
    "facebookUserName" TEXT,
    "facebookProfileImage" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaAccount_userId_idx" ON "MetaAccount"("userId");

-- CreateIndex
CREATE INDEX "MetaAccount_facebookUserId_idx" ON "MetaAccount"("facebookUserId");

-- CreateIndex
CREATE INDEX "MetaAccount_status_idx" ON "MetaAccount"("status");

-- CreateIndex
CREATE INDEX "MetaAccount_tokenExpiresAt_idx" ON "MetaAccount"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAccount_userId_facebookUserId_key" ON "MetaAccount"("userId", "facebookUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ConnectedPage_metaAccountId_idx" ON "ConnectedPage"("metaAccountId");

-- CreateIndex
CREATE INDEX "ConnectedPage_status_idx" ON "ConnectedPage"("status");

-- CreateIndex
CREATE INDEX "ConnectedPage_tokenExpiresAt_idx" ON "ConnectedPage"("tokenExpiresAt");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE INDEX "DownloadHistory_version_idx" ON "DownloadHistory"("version");

-- CreateIndex
CREATE INDEX "DownloadHistory_createdAt_idx" ON "DownloadHistory"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "ScheduleJob_scheduledAt_idx" ON "ScheduleJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduleJob_contentType_idx" ON "ScheduleJob"("contentType");

-- CreateIndex
CREATE INDEX "Subscription_plan_idx" ON "Subscription"("plan");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "MetaAccount" ADD CONSTRAINT "MetaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedPage" ADD CONSTRAINT "ConnectedPage_metaAccountId_fkey" FOREIGN KEY ("metaAccountId") REFERENCES "MetaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

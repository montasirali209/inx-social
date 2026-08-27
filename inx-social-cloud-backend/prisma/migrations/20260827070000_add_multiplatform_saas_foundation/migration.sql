-- Phase 12.0: platform-neutral connections, profiles, content and publications.
-- Existing Facebook tables remain active until connector-specific migrations run.
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'BUSINESS',
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopesJson" TEXT,
    "metadataJson" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalProfileId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "profileType" TEXT NOT NULL DEFAULT 'PAGE',
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "capabilitiesJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "altText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourcePlanId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPublication" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "platformCaption" TEXT,
    "platformAltText" TEXT,
    "mediaJson" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "idempotencyKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metricsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_userId_platform_externalAccountId_key" ON "SocialConnection"("userId", "platform", "externalAccountId");
CREATE INDEX "SocialConnection_userId_platform_idx" ON "SocialConnection"("userId", "platform");
CREATE INDEX "SocialConnection_status_idx" ON "SocialConnection"("status");
CREATE INDEX "SocialConnection_tokenExpiresAt_idx" ON "SocialConnection"("tokenExpiresAt");
CREATE UNIQUE INDEX "SocialProfile_connectionId_externalProfileId_key" ON "SocialProfile"("connectionId", "externalProfileId");
CREATE INDEX "SocialProfile_userId_platform_idx" ON "SocialProfile"("userId", "platform");
CREATE INDEX "SocialProfile_status_idx" ON "SocialProfile"("status");
CREATE INDEX "SocialProfile_isDefault_idx" ON "SocialProfile"("isDefault");
CREATE INDEX "SocialContent_userId_status_idx" ON "SocialContent"("userId", "status");
CREATE INDEX "SocialContent_approvalStatus_idx" ON "SocialContent"("approvalStatus");
CREATE INDEX "SocialContent_sourcePlanId_idx" ON "SocialContent"("sourcePlanId");
CREATE INDEX "SocialContent_createdAt_idx" ON "SocialContent"("createdAt");
CREATE UNIQUE INDEX "SocialPublication_profileId_idempotencyKey_key" ON "SocialPublication"("profileId", "idempotencyKey");
CREATE INDEX "SocialPublication_contentId_status_idx" ON "SocialPublication"("contentId", "status");
CREATE INDEX "SocialPublication_profileId_scheduledAt_idx" ON "SocialPublication"("profileId", "scheduledAt");
CREATE INDEX "SocialPublication_platform_status_idx" ON "SocialPublication"("platform", "status");
CREATE INDEX "SocialPublication_externalPostId_idx" ON "SocialPublication"("externalPostId");

ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "SocialContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

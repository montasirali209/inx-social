CREATE TABLE "AiCreditWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "monthlyBalance" INTEGER NOT NULL DEFAULT 0,
  "topupBalance" INTEGER NOT NULL DEFAULT 0,
  "monthlyLimit" INTEGER NOT NULL DEFAULT 500,
  "periodKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCreditWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiCreditWallet_userId_key" UNIQUE ("userId"),
  CONSTRAINT "AiCreditWallet_monthlyBalance_check" CHECK ("monthlyBalance" >= 0),
  CONSTRAINT "AiCreditWallet_topupBalance_check" CHECK ("topupBalance" >= 0),
  CONSTRAINT "AiCreditWallet_monthlyLimit_check" CHECK ("monthlyLimit" >= 0),
  CONSTRAINT "AiCreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiGeneration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARING',
  "taskUuid" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'runware',
  "model" TEXT,
  "prompt" TEXT NOT NULL,
  "requestJson" TEXT,
  "responseJson" TEXT,
  "providerCostUsd" DECIMAL(12,6),
  "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  "reservedMonthly" INTEGER NOT NULL DEFAULT 0,
  "reservedTopup" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "assetJson" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiGeneration_taskUuid_key" UNIQUE ("taskUuid"),
  CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiCreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "generationId" TEXT,
  "type" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceMonthly" INTEGER NOT NULL,
  "balanceTopup" INTEGER NOT NULL,
  "reference" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCreditTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiCreditTransaction_reference_key" UNIQUE ("reference"),
  CONSTRAINT "AiCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiCreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "AiCreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiCreditTransaction_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AiGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "prompt" TEXT,
  "caption" TEXT,
  "hashtagsJson" TEXT NOT NULL DEFAULT '[]',
  "altText" TEXT,
  "assetJson" TEXT,
  "mediaLibraryAssetIdsJson" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AiGeneration_userId_createdAt_idx" ON "AiGeneration"("userId", "createdAt");
CREATE INDEX "AiGeneration_userId_status_idx" ON "AiGeneration"("userId", "status");
CREATE INDEX "AiCreditTransaction_userId_createdAt_idx" ON "AiCreditTransaction"("userId", "createdAt");
CREATE INDEX "AiCreditTransaction_generationId_idx" ON "AiCreditTransaction"("generationId");
CREATE INDEX "AiDraft_userId_updatedAt_idx" ON "AiDraft"("userId", "updatedAt");
CREATE INDEX "AiDraft_userId_status_idx" ON "AiDraft"("userId", "status");

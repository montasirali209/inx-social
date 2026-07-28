ALTER TABLE "Subscription"
ADD COLUMN "graceEndsAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentFailedAt" TIMESTAMP(3);

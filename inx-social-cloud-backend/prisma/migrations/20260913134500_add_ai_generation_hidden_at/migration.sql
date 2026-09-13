ALTER TABLE "AiGeneration"
ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AiGeneration_userId_hiddenAt_createdAt_idx"
ON "AiGeneration"("userId", "hiddenAt", "createdAt");

ALTER TABLE "AgentAsset"
ADD COLUMN "customerPrompt" TEXT,
ADD COLUMN "exactOverlayText" TEXT,
ADD COLUMN "generationChoice" TEXT,
ADD COLUMN "qualityScore" INTEGER,
ADD COLUMN "qualityIssuesJson" TEXT;

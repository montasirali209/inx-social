ALTER TABLE "AiPostCampaign"
ADD COLUMN "imagePostCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AiPostCampaignPost"
ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'TEXT';

UPDATE "AiPostCampaign"
SET "imagePostCount" = "postCount"
WHERE "contentMode" = 'IMAGE';

UPDATE "AiPostCampaignPost" AS post
SET "contentType" = CASE WHEN campaign."contentMode" = 'IMAGE' THEN 'IMAGE' ELSE 'TEXT' END
FROM "AiPostCampaign" AS campaign
WHERE post."campaignId" = campaign."id";

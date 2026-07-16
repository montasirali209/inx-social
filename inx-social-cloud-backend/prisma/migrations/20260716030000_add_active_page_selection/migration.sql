-- Add a user workspace selection flag to connected Facebook Pages.
ALTER TABLE "ConnectedPage"
ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ConnectedPage_isSelected_idx"
ON "ConnectedPage"("isSelected");

-- Preserve a sensible default for existing users by selecting their newest active Page.
WITH ranked_pages AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "connectedAt" DESC, "createdAt" DESC
    ) AS row_number
  FROM "ConnectedPage"
  WHERE "status" = 'ACTIVE'
)
UPDATE "ConnectedPage" AS page
SET "isSelected" = true
FROM ranked_pages
WHERE page."id" = ranked_pages."id"
  AND ranked_pages.row_number = 1;

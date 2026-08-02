-- INX Social streams video content to Meta and does not retain cloud captions.
-- Historical cloud captions are removed while audit metadata remains intact.
UPDATE "ScheduleJob"
SET "caption" = NULL
WHERE "origin" = 'CLOUD'
  AND "caption" IS NOT NULL;

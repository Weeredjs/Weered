INSERT INTO "User" ("id","name","createdAt","updatedAt")
SELECT DISTINCT r."ownerId", r."ownerId", NOW(), NOW()
FROM "Room" r
LEFT JOIN "User" u ON u."id" = r."ownerId"
WHERE r."ownerId" IS NOT NULL AND u."id" IS NULL;
-- The Bre-B integration is ready for production. Keep this rollout switch in
-- SystemConfig so operations can disable it without rebuilding the app.
INSERT INTO "SystemConfig" ("id", "key", "value", "updatedAt")
VALUES ('wallet-topups-enabled', 'WALLET_TOPUPS_ENABLED', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "updatedAt" = CURRENT_TIMESTAMP;

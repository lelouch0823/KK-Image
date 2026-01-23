-- Migration number: 0020
DROP TABLE IF EXISTS SystemSettings;
CREATE TABLE SystemSettings (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

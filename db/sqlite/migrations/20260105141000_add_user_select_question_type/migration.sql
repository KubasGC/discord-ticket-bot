-- AlterTable: Add allowedRoles column to questions
-- SQLite uses String for type field, no enum modification needed
ALTER TABLE "questions" ADD COLUMN "allowedRoles" TEXT NOT NULL DEFAULT '[]';

-- AlterEnum: Add USER_SELECT to QuestionType enum
ALTER TYPE "QuestionType" ADD VALUE 'USER_SELECT';

-- AlterTable: Add allowedRoles column to questions
ALTER TABLE "questions" ADD COLUMN "allowedRoles" JSONB NOT NULL DEFAULT '[]';

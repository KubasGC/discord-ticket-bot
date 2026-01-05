-- AlterTable: Add USER_SELECT to QuestionType enum
ALTER TABLE `questions` MODIFY COLUMN `type` ENUM('MENU', 'TEXT', 'USER_SELECT') NOT NULL DEFAULT 'TEXT';

-- AlterTable: Add allowedRoles column to questions
ALTER TABLE `questions` ADD COLUMN `allowedRoles` JSON NOT NULL DEFAULT ('[]');

-- CreateTable
CREATE TABLE `panels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `guildId` VARCHAR(19) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(256) NULL,
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `thumbnail` VARCHAR(191) NULL,
    `type` ENUM('BUTTON', 'MENU', 'MESSAGE') NOT NULL DEFAULT 'BUTTON',
    `categories` JSON NOT NULL,

    UNIQUE INDEX `panels_guildId_name_key`(`guildId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panelMessages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `panelId` INTEGER NOT NULL,
    `channelId` VARCHAR(19) NOT NULL,
    `messageId` VARCHAR(19) NOT NULL,

    UNIQUE INDEX `panelMessages_channelId_messageId_key`(`channelId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `panels` ADD CONSTRAINT `panels_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `guilds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panelMessages` ADD CONSTRAINT `panelMessages_panelId_fkey` FOREIGN KEY (`panelId`) REFERENCES `panels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

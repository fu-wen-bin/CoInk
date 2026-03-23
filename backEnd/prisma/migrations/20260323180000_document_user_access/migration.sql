-- CreateTable
CREATE TABLE `document_user_access` (
    `document_id` VARCHAR(21) NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `last_accessed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`document_id`, `user_id`),
    INDEX `idx_doc_access_user_time`(`user_id`, `last_accessed_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 按用户维度的收藏（避免协作者收藏时写入 documents_info.is_starred 与所有者冲突）
CREATE TABLE `document_user_star` (
    `document_id` VARCHAR(21) NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`document_id`, `user_id`),
    INDEX `idx_doc_star_user` (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 迁移历史数据：原 is_starred 视为「所有者本人收藏」
INSERT INTO `document_user_star` (`document_id`, `user_id`, `created_at`)
SELECT `document_id`, `owner_id`, `updated_at`
FROM `documents_info`
WHERE `is_starred` = 1;

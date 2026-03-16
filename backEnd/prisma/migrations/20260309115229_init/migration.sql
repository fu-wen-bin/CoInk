-- CreateTable
CREATE TABLE `document_contents` (
    `document_id` VARCHAR(21) NOT NULL,
    `content` JSON NOT NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_by` VARCHAR(21) NULL,

    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_principals` (
    `document_id` VARCHAR(21) NOT NULL,
    `principal_type` ENUM('user', 'group') NOT NULL,
    `principal_id` VARCHAR(21) NOT NULL,
    `permission` ENUM('view', 'comment', 'edit', 'manage', 'full') NOT NULL,
    `granted_by` VARCHAR(21) NULL,
    `granted_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` DATETIME(0) NULL,

    INDEX `idx_doc_principal_doc`(`document_id`),
    INDEX `idx_doc_principal_type_id`(`principal_type`, `principal_id`),
    PRIMARY KEY (`document_id`, `principal_type`, `principal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `version_id` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `document_id` VARCHAR(21) NULL,
    `title` VARCHAR(512) NOT NULL,
    `content` JSON NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_id` VARCHAR(21) NOT NULL,

    INDEX `idx_doc_versions_doc_ver`(`version_id` DESC),
    PRIMARY KEY (`version_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents_info` (
    `document_id` VARCHAR(21) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `type` ENUM('FILE', 'FOLDER') NOT NULL,
    `owner_id` VARCHAR(21) NOT NULL,
    `parent_id` VARCHAR(21) NULL,
    `is_starred` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `share_token` VARCHAR(64) NOT NULL,
    `link_permission` ENUM('close', 'view', 'edit') NULL DEFAULT 'close',

    INDEX `idx_documents_owner`(`owner_id`),
    INDEX `idx_documents_parent`(`parent_id`),
    INDEX `idx_documents_type`(`type`),
    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `group_id` VARCHAR(21) NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_group_members_user`(`user_id`),
    PRIMARY KEY (`group_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `group_id` VARCHAR(21) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `owner_id` VARCHAR(21) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_groups_owner`(`owner_id`),
    PRIMARY KEY (`group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notifications_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `request_id` BIGINT UNSIGNED NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `payload` JSON NULL,
    `read_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created`(`created_at`),
    INDEX `idx_user_read`(`user_id`, `read_at`),
    PRIMARY KEY (`notifications_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission_requests` (
    `request_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_id` VARCHAR(21) NOT NULL,
    `applicant_id` VARCHAR(21) NOT NULL,
    `target_permission` ENUM('view', 'comment', 'edit', 'manage', 'full') NOT NULL,
    `message` VARCHAR(512) NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
    `reviewer_id` VARCHAR(21) NULL,
    `expires_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_applicant`(`applicant_id`),
    INDEX `idx_doc_status`(`document_id`, `status`),
    INDEX `idx_reviewer_status`(`reviewer_id`, `status`),
    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` VARCHAR(21) NOT NULL,
    `email` VARCHAR(255) NULL,
    `name` VARCHAR(20) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `github_id` BIGINT UNSIGNED NULL,
    `github_username` VARCHAR(255) NULL,
    `avatar_url` VARCHAR(512) NULL,
    `website_url` VARCHAR(512) NULL,
    `location` VARCHAR(255) NULL,
    `company` VARCHAR(255) NULL,
    `bio` TEXT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
    `last_login_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_users_email`(`email`),
    UNIQUE INDEX `github_id`(`github_id`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `templates` (
    `template_id` VARCHAR(21) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `description` VARCHAR(1024) NULL,
    `content` JSON NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `tags` JSON NULL,
    `thumbnail_url` VARCHAR(512) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `is_official` BOOLEAN NOT NULL DEFAULT false,
    `creator_id` VARCHAR(21) NOT NULL,
    `use_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_templates_category`(`category`),
    INDEX `idx_templates_creator`(`creator_id`),
    INDEX `idx_templates_public`(`is_public`),
    INDEX `idx_templates_official`(`is_official`),
    INDEX `idx_templates_title`(`title`),
    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_comments` (
    `comment_id` VARCHAR(21) NOT NULL,
    `document_id` VARCHAR(21) NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `content` TEXT NOT NULL,
    `parent_id` VARCHAR(21) NULL,
    `position` JSON NULL,
    `is_resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolved_by` VARCHAR(21) NULL,
    `resolved_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_comments_document`(`document_id`),
    INDEX `idx_comments_user`(`user_id`),
    INDEX `idx_comments_parent`(`parent_id`),
    INDEX `idx_comments_resolved`(`is_resolved`),
    INDEX `idx_comments_created`(`created_at`),
    PRIMARY KEY (`comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blogs` (
    `blog_id` VARCHAR(21) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `summary` VARCHAR(1024) NULL,
    `content` JSON NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `tags` JSON NULL,
    `cover_image` VARCHAR(512) NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_blogs_user`(`user_id`),
    INDEX `idx_blogs_category`(`category`),
    PRIMARY KEY (`blog_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `file_id` VARCHAR(21) NOT NULL,
    `file_hash` VARCHAR(64) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_path` VARCHAR(512) NOT NULL,
    `user_id` VARCHAR(21) NOT NULL,
    `chunk_count` INTEGER NULL,
    `is_complete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `files_file_hash_key`(`file_hash`),
    INDEX `idx_files_hash`(`file_hash`),
    INDEX `idx_files_user`(`user_id`),
    PRIMARY KEY (`file_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================================
-- CoInk 数据库初始化脚本（MySQL 8.x）
-- 与 backEnd/prisma/schema.prisma 对齐（当前版本）
-- 说明：
-- 1) 本项目当前主要依赖应用层约束，未在此脚本中强制添加外键。
-- 2) 协同编辑采用双写：document_contents.content + document_contents.y_state。
-- =========================================================

CREATE DATABASE IF NOT EXISTS `coInk`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `coInk`;

-- =========================================================
-- 0. Prisma 迁移元表
-- =========================================================
CREATE TABLE IF NOT EXISTS `_prisma_migrations`
(
    `id`                  VARCHAR(36)                               NOT NULL,
    `checksum`            VARCHAR(64)                               NOT NULL,
    `finished_at`         DATETIME(3)                               NULL,
    `migration_name`      VARCHAR(255)                              NOT NULL,
    `logs`                TEXT                                      NULL,
    `rolled_back_at`      DATETIME(3)                               NULL,
    `started_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `applied_steps_count` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Prisma migration 元数据表';

-- =========================================================
-- 1. 用户表 users
-- =========================================================
CREATE TABLE IF NOT EXISTS `users`
(
    `user_id`         VARCHAR(21)  NOT NULL COMMENT '用户ID（nanoId）',
    `email`           VARCHAR(255) NULL COMMENT '邮箱，可空（如仅 GitHub 登录）',
    `name`            VARCHAR(20)  NOT NULL COMMENT '显示名',
    `password_hash`   VARCHAR(255) NULL COMMENT '密码哈希（邮箱登录使用）',
    `github_id`       BIGINT UNSIGNED NULL COMMENT 'GitHub 用户ID',
    `github_username` VARCHAR(255) NULL COMMENT 'GitHub 用户名',
    `avatar_url`      VARCHAR(512) NULL COMMENT '头像地址',
    `website_url`     VARCHAR(512) NULL COMMENT '个人主页',
    `location`        VARCHAR(255) NULL COMMENT '所在地区',
    `company`         VARCHAR(255) NULL COMMENT '公司/组织',
    `bio`             TEXT NULL COMMENT '个人简介',
    `role`            VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '角色标识',
    `last_login_at`   DATETIME NULL COMMENT '最后登录时间',
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uk_users_email` (`email`),
    UNIQUE KEY `github_id` (`github_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户主表';

-- =========================================================
-- 2. 文档元数据表 documents_info
-- =========================================================
CREATE TABLE IF NOT EXISTS `documents_info`
(
    `document_id`     VARCHAR(21) NOT NULL COMMENT '文档ID（nanoId）',
    `title`           VARCHAR(512) NOT NULL COMMENT '文档/文件夹标题',
    `type`            ENUM ('FILE','FOLDER') NOT NULL COMMENT '节点类型',
    `owner_id`        VARCHAR(21) NOT NULL COMMENT '拥有者用户ID',
    `parent_id`       VARCHAR(21) NULL COMMENT '父级文档ID，NULL 表示根',
    `sort_order`      INT NOT NULL DEFAULT 0 COMMENT '排序权重',
    `is_deleted`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除标记',
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    `share_token`     VARCHAR(64) NOT NULL COMMENT '公开分享 token',
    `link_permission` ENUM ('close','view','edit') NULL DEFAULT 'close' COMMENT '公开链接权限',
    PRIMARY KEY (`document_id`),
    KEY `idx_documents_owner` (`owner_id`),
    KEY `idx_documents_parent` (`parent_id`),
    KEY `idx_documents_type` (`type`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '文档树结构与共享元数据';

-- =========================================================
-- 3. 文档内容表 document_contents
-- =========================================================
CREATE TABLE IF NOT EXISTS `document_contents`
(
    `document_id` VARCHAR(21) NOT NULL COMMENT '文档ID',
    `content`     JSON NOT NULL COMMENT 'TipTap/ProseMirror JSON',
    `y_state`     MEDIUMBLOB NULL COMMENT 'Yjs encodeStateAsUpdate 快照',
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    `updated_by`  VARCHAR(21) NULL COMMENT '最后更新者用户ID',
    PRIMARY KEY (`document_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '文档正文（JSON + Yjs 双写）';

-- =========================================================
-- 4. 文档历史版本表 document_versions
-- 注意：复合主键 (document_id, version_id) 与后端逻辑保持一致
-- =========================================================
CREATE TABLE IF NOT EXISTS `document_versions`
(
    `document_id` VARCHAR(21) NOT NULL COMMENT '文档ID',
    `version_id`  TIMESTAMP NOT NULL COMMENT '版本时间戳（秒精度）',
    `title`       VARCHAR(512) NOT NULL COMMENT '当时标题',
    `description` TEXT NULL COMMENT '版本说明',
    `content`     JSON NOT NULL COMMENT '当时 JSON 内容',
    `y_state`     MEDIUMBLOB NULL COMMENT '当时 Yjs 状态快照',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '版本创建时间',
    `user_id`     VARCHAR(21) NOT NULL COMMENT '创建版本的用户ID',
    PRIMARY KEY (`document_id`, `version_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '文档历史版本快照';

-- =========================================================
-- 5. 文档访问与收藏
-- =========================================================
CREATE TABLE IF NOT EXISTS `document_user_access`
(
    `document_id`      VARCHAR(21) NOT NULL COMMENT '文档ID',
    `user_id`          VARCHAR(21) NOT NULL COMMENT '用户ID',
    `last_accessed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近访问时间',
    PRIMARY KEY (`document_id`, `user_id`),
    KEY `idx_doc_access_user_time` (`user_id`, `last_accessed_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户最近访问文档';

CREATE TABLE IF NOT EXISTS `document_user_star`
(
    `document_id` VARCHAR(21) NOT NULL COMMENT '文档ID',
    `user_id`     VARCHAR(21) NOT NULL COMMENT '用户ID',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    PRIMARY KEY (`document_id`, `user_id`),
    KEY `idx_doc_star_user` (`user_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户文档收藏关系';

-- =========================================================
-- 6. 团队与成员
-- =========================================================
CREATE TABLE IF NOT EXISTS `groups`
(
    `group_id`   VARCHAR(21) NOT NULL COMMENT '组ID',
    `name`       VARCHAR(255) NOT NULL COMMENT '组名',
    `owner_id`   VARCHAR(21) NOT NULL COMMENT '组拥有者用户ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`group_id`),
    KEY `idx_groups_owner` (`owner_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户组';

CREATE TABLE IF NOT EXISTS `group_members`
(
    `group_id`  VARCHAR(21) NOT NULL COMMENT '组ID',
    `user_id`   VARCHAR(21) NOT NULL COMMENT '用户ID',
    `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    PRIMARY KEY (`group_id`, `user_id`),
    KEY `idx_group_members_user` (`user_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '组成员关系';

-- =========================================================
-- 7. 文档权限 ACL（主体：用户/组）
-- =========================================================
CREATE TABLE IF NOT EXISTS `document_principals`
(
    `document_id`    VARCHAR(21) NOT NULL COMMENT '文档ID',
    `principal_type` ENUM ('user','group') NOT NULL COMMENT '主体类型',
    `principal_id`   VARCHAR(21) NOT NULL COMMENT '主体ID（用户ID或组ID）',
    `permission`     ENUM ('view','comment','edit','manage') NOT NULL COMMENT '权限等级',
    `granted_by`     VARCHAR(21) NULL COMMENT '授权人用户ID',
    `granted_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    `expires_at`     DATETIME NULL COMMENT '过期时间',
    PRIMARY KEY (`document_id`, `principal_type`, `principal_id`),
    KEY `idx_doc_principal_doc` (`document_id`),
    KEY `idx_doc_principal_type_id` (`principal_type`, `principal_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '文档 ACL 权限表';

-- =========================================================
-- 8. 权限申请与通知
-- =========================================================
CREATE TABLE IF NOT EXISTS `permission_requests`
(
    `request_id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申请ID',
    `document_id`       VARCHAR(21) NOT NULL COMMENT '文档ID',
    `applicant_id`      VARCHAR(21) NOT NULL COMMENT '申请人用户ID',
    `target_permission` ENUM ('view','comment','edit','manage') NOT NULL COMMENT '目标权限',
    `message`           VARCHAR(512) NULL COMMENT '申请说明',
    `status`            ENUM ('pending','approved','rejected','cancelled','expired') NOT NULL DEFAULT 'pending' COMMENT '申请状态',
    `reviewer_id`       VARCHAR(21) NULL COMMENT '审批人用户ID',
    `expires_at`        DATETIME NULL COMMENT '申请过期时间',
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`request_id`),
    KEY `idx_applicant` (`applicant_id`),
    KEY `idx_doc_status` (`document_id`, `status`),
    KEY `idx_reviewer_status` (`reviewer_id`, `status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '权限申请记录';

CREATE TABLE IF NOT EXISTS `notifications`
(
    `notifications_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
    `request_id`       BIGINT UNSIGNED NOT NULL COMMENT '关联权限申请ID',
    `user_id`          VARCHAR(21) NOT NULL COMMENT '接收通知用户ID',
    `type`             VARCHAR(64) NOT NULL COMMENT '通知类型',
    `payload`          JSON NULL COMMENT '扩展负载',
    `read_at`          DATETIME NULL COMMENT '已读时间',
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`notifications_id`),
    KEY `idx_user_read` (`user_id`, `read_at`),
    KEY `idx_created` (`created_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '站内通知';

-- =========================================================
-- 9. 好友系统
-- =========================================================
CREATE TABLE IF NOT EXISTS `friend_requests`
(
    `request_id`   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '请求ID',
    `requester_id` VARCHAR(21) NOT NULL COMMENT '发起人用户ID',
    `receiver_id`  VARCHAR(21) NOT NULL COMMENT '接收人用户ID',
    `status`       ENUM ('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending' COMMENT '请求状态',
    `message`      VARCHAR(512) NULL COMMENT '附言',
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`request_id`),
    KEY `idx_friend_req_requester_status` (`requester_id`, `status`),
    KEY `idx_friend_req_receiver_status` (`receiver_id`, `status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '好友申请';

CREATE TABLE IF NOT EXISTS `friends`
(
    `user_id`    VARCHAR(21) NOT NULL COMMENT '用户ID',
    `friend_id`  VARCHAR(21) NOT NULL COMMENT '好友用户ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '建立好友关系时间',
    PRIMARY KEY (`user_id`, `friend_id`),
    KEY `idx_friends_friend` (`friend_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '好友关系（有向存储）';

-- =========================================================
-- 10. 文件上传表（秒传 + 分片上传）
-- =========================================================
CREATE TABLE IF NOT EXISTS `files`
(
    `file_id`     VARCHAR(21) NOT NULL COMMENT '文件记录ID',
    `file_hash`   VARCHAR(64) NOT NULL COMMENT '文件哈希（用于秒传）',
    `file_name`   VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `file_size`   INT NOT NULL COMMENT '文件大小（字节）',
    `mime_type`   VARCHAR(100) NOT NULL COMMENT 'MIME 类型',
    `file_path`   VARCHAR(512) NOT NULL COMMENT '存储路径',
    `user_id`     VARCHAR(21) NOT NULL COMMENT '上传者用户ID',
    `chunk_count` INT NULL COMMENT '分片总数',
    `is_complete` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否上传完成',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`file_id`),
    UNIQUE KEY `files_file_hash_key` (`file_hash`),
    KEY `idx_files_hash` (`file_hash`),
    KEY `idx_files_user` (`user_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '文件上传与秒传索引';

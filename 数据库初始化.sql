-- 创建数据库
create database coInk;
use coInk;

-- ==========================================
-- 1. 用户表 (users)
-- 存储核心用户信息，支持多种登录方式（邮箱/GitHub）
-- ==========================================
CREATE TABLE users
(
    user_id       VARCHAR(21) NOT NULL PRIMARY KEY COMMENT '用户ID (nanoId)',
    email         VARCHAR(255) COMMENT '用户邮箱，可为空用于 GitHub 登录后再补充',
    name          VARCHAR(20) NOT NULL COMMENT '显示名',
    password_hash VARCHAR(255)         DEFAULT NULL COMMENT 'BCrypt 等哈希；邮箱密码登录使用',
    github_id     BIGINT UNSIGNED      DEFAULT NULL UNIQUE COMMENT 'GitHub 用户 ID',
    avatar_url    VARCHAR(512)         DEFAULT NULL,
    website_url   VARCHAR(512)         DEFAULT NULL,
    last_login_at DATETIME             DEFAULT NULL,
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='用户主表';

-- ==========================================
-- 2. 文档元数据表 (documents)
-- 存储文档和文件夹的树状结构信息及基本属性
-- 注意：实际文档内容存储在 update_contents 表中
-- ==========================================
CREATE TABLE documents_info
(
    document_id     VARCHAR(21) PRIMARY KEY,
    title           VARCHAR(512)           NOT NULL,                -- 文档标题
    type            ENUM ('FILE','FOLDER') NOT NULL,                -- 类型：文件 或 文件夹
    owner_id        VARCHAR(21)            NOT NULL,                -- users.id，文档所有者
    parent_id       VARCHAR(21),                                    -- documents.id，父节点ID，为 NULL 则为根目录
    is_starred      BOOLEAN                NOT NULL DEFAULT FALSE,  -- 是否星标/收藏
    sort_order      INT                    NOT NULL DEFAULT 0,      -- 排序权重
    is_deleted      BOOLEAN                NOT NULL DEFAULT FALSE,  -- 软删除标记，用于回收站功能
    created_at      DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    share_token     VARCHAR(64)            NOT NULL,                -- 公开分享链接的唯一Token
    link_permission ENUM ('close','view','edit')    DEFAULT 'close' -- 公开链接权限：关闭/仅查看/可编辑
);

-- 常用索引（无 FK，但需加速查询）
CREATE INDEX idx_documents_owner ON documents_info (owner_id);
CREATE INDEX idx_documents_parent ON documents_info (parent_id);
CREATE INDEX idx_documents_type ON documents_info (type);

-- ==========================================
-- 3. 文档内容表 (document_contents)
-- 独立存储文档的 JSON 数据，实现元数据与大内容的冷热分离
-- ==========================================
CREATE TABLE document_contents
(
    document_id VARCHAR(21) PRIMARY KEY, -- 关联 documents.id
    content     JSON     NOT NULL,       -- 实际内容数据（JSON格式）
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by  VARCHAR(21)              -- 最后更新者的 users.id
);

-- ==========================================
-- 4. 文档历史版本表 (document_versions)
-- 记录文档的历史变更，用于版本回滚
-- ==========================================
CREATE TABLE document_versions
(
    version_id  TIMESTAMP PRIMARY KEY DEFAULT CURRENT_TIMESTAMP, -- 版本ID（这里使用时间戳作为主键）
    document_id VARCHAR(21),                                     -- 关联 documents.id
    title       VARCHAR(512) NOT NULL,                           -- 版本当时的标题
    content     JSON         NOT NULL,                           -- 版本当时的内容（或存储 blob url）
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id     VARCHAR(21)  NOT NULL                            -- 创建此版本的 users.id
);

CREATE INDEX idx_doc_versions_doc_ver ON document_versions (version_id DESC);

-- ==========================================
-- 5. 用户组表 (groups)
-- 用于权限管理的团队/小组概念
-- ==========================================
CREATE TABLE `groups`
(
    group_id   VARCHAR(21) PRIMARY KEY,
    name       VARCHAR(255) NOT NULL, -- 组名称
    owner_id   VARCHAR(21)  NOT NULL, -- 组创建者/拥有者 users.id
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_groups_owner (owner_id)
);

-- ==========================================
-- 6. 组成员表 (group_members)
-- 记录用户与组的多对多归属关系
-- ==========================================
CREATE TABLE group_members
(
    group_id  VARCHAR(21) NOT NULL,
    user_id   VARCHAR(21) NOT NULL,
    joined_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    KEY idx_group_members_user (user_id)
);

-- ==========================================
-- 7. 文档权限控制表 (ACL - document_principals)
-- 细粒度权限控制，定义“谁”对“哪个文档”有什么权限 / 文档公网访问地址的权限在文档信息表中定义
-- ==========================================
CREATE TABLE document_principals
(
    document_id    VARCHAR(21)                                    NOT NULL, -- 目标文档 ID
    principal_type ENUM ('user','group')                          NOT NULL, -- 主体类型：是单个用户还是一个组
    principal_id   VARCHAR(21)                                    NOT NULL, -- 主体 ID：对应的 user_id 或 group_id
    permission     ENUM ('view','comment','edit','manage','full') NOT NULL, -- 具体的权限级别
    granted_by     VARCHAR(21),                                             -- 授权操作人 users.id
    granted_at     DATETIME                                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME                                       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    expires_at     DATETIME                                       NULL,     -- 权限过期时间（如有）
    PRIMARY KEY (document_id, principal_type, principal_id),
    KEY idx_doc_principal_type_id (principal_type, principal_id),
    KEY idx_doc_principal_doc (document_id)
);

-- ==========================================
-- 8. 通知主表 (notifications)
-- 存储用户收到的通知，含未读/已读状态
-- ==========================================
CREATE TABLE notifications
(
    notifications_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    request_id       BIGINT UNSIGNED NOT NULL COMMENT '关联的权限申请ID（如有）',
    user_id          VARCHAR(21)     NOT NULL COMMENT '收件人用户ID',
    type             VARCHAR(64)     NOT NULL COMMENT '通知类型，如 permission_request/request_approved/request_rejected',
    payload          JSON                     DEFAULT NULL COMMENT '通知负载，存储文档ID、申请理由等扩展字段',
    read_at          DATETIME                 DEFAULT NULL COMMENT '已读时间，NULL 表示未读',
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (notifications_id),
    INDEX idx_user_read (user_id, read_at), -- 拉取未读/已读
    INDEX idx_created (created_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='通知表：入库 + 未读/已读管理';

-- ==========================================
-- 9. 权限申请表 (permission_requests)
-- 存储用户对文档权限的申请记录
-- ==========================================
CREATE TABLE permission_requests
(
    request_id        BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT COMMENT '主键',
    document_id       VARCHAR(21)                                                  NOT NULL COMMENT '文档/资源 ID',
    applicant_id      VARCHAR(21)                                                  NOT NULL COMMENT '申请人用户 ID',
    target_permission ENUM ('view','comment','edit','manage','full')               NOT NULL COMMENT '申请的目标权限',
    message           VARCHAR(512)                                                          DEFAULT NULL COMMENT '申请理由',
    status            ENUM ('pending','approved','rejected','cancelled','expired') NOT NULL DEFAULT 'pending' COMMENT '申请状态',
    reviewer_id       VARCHAR(21)                                                           DEFAULT NULL COMMENT '审批人用户 ID',
    expires_at        DATETIME                                                              DEFAULT NULL COMMENT '申请有效期（可选）',
    created_at        DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at        DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (request_id),
    INDEX idx_doc_status (document_id, status),
    INDEX idx_applicant (applicant_id),
    INDEX idx_reviewer_status (reviewer_id, status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='权限申请表：pending/审批/拒绝等';
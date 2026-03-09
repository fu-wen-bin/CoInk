# CoInk 数据库设计文档

## 概述

CoInk 是一个多人在线协同文档系统，数据库设计支持：
- 用户认证与授权
- 文档管理与版本控制
- 权限管理（用户/组级别）
- 评论系统
- 模板系统

## 表结构

### 1. users - 用户表

存储用户基本信息。

| 字段            | 类型                  | 说明               |
|---------------|---------------------|------------------|
| user_id       | VARCHAR(21) PK      | 用户唯一标识（nanoid生成） |
| email         | VARCHAR(255) UNIQUE | 邮箱地址             |
| name          | VARCHAR(20)         | 用户名              |
| password_hash | VARCHAR(255)        | 密码哈希（argon2）     |
| github_id     | BIGINT UNIQUE       | GitHub OAuth ID  |
| avatar_url    | VARCHAR(512)        | 头像URL            |
| website_url   | VARCHAR(512)        | 个人网站             |
| last_login_at | DATETIME            | 最后登录时间           |
| created_at    | DATETIME            | 创建时间             |
| updated_at    | DATETIME            | 更新时间             |

### 2. documents_info - 文档信息表

存储文档/文件夹的元数据。

| 字段              | 类型                            | 说明             |
|-----------------|-------------------------------|----------------|
| document_id     | VARCHAR(21) PK                | 文档唯一标识         |
| title           | VARCHAR(512)                  | 标题             |
| type            | ENUM('FILE', 'FOLDER')        | 类型             |
| owner_id        | VARCHAR(21)                   | 所有者ID          |
| parent_id       | VARCHAR(21)                   | 父文件夹ID（支持目录结构） |
| is_starred      | BOOLEAN                       | 是否星标           |
| sort_order      | INT                           | 排序顺序           |
| is_deleted      | BOOLEAN                       | 软删除标记          |
| share_token     | VARCHAR(64)                   | 分享令牌           |
| link_permission | ENUM('close', 'view', 'edit') | 链接分享权限         |
| created_at      | DATETIME                      | 创建时间           |
| updated_at      | DATETIME                      | 更新时间           |

### 3. document_contents - 文档内容表

存储文档的JSON内容，与documents_info一对一。

| 字段          | 类型             | 说明             |
|-------------|----------------|----------------|
| document_id | VARCHAR(21) PK | 文档ID           |
| content     | JSON           | 文档内容（TipTap格式） |
| updated_at  | DATETIME       | 更新时间           |
| updated_by  | VARCHAR(21)    | 最后更新者ID        |

### 4. document_versions - 文档版本表

存储文档历史版本。

| 字段          | 类型           | 说明         |
|-------------|--------------|------------|
| version_id  | TIMESTAMP PK | 版本ID（自动生成） |
| document_id | VARCHAR(21)  | 文档ID       |
| title       | VARCHAR(512) | 版本时标题      |
| content     | JSON         | 版本内容       |
| created_at  | DATETIME     | 创建时间       |
| user_id     | VARCHAR(21)  | 创建者ID      |

### 5. document_principals - 文档权限表

存储文档的用户/组权限。

| 字段             | 类型                    | 说明                                 |
|----------------|-----------------------|------------------------------------|
| document_id    | VARCHAR(21)           | 文档ID                               |
| principal_type | ENUM('user', 'group') | 主体类型                               |
| principal_id   | VARCHAR(21)           | 主体ID                               |
| permission     | ENUM                  | 权限级别：view/comment/edit/manage/full |
| granted_by     | VARCHAR(21)           | 授权者ID                              |
| granted_at     | DATETIME              | 授权时间                               |
| updated_at     | DATETIME              | 更新时间                               |
| expires_at     | DATETIME              | 过期时间                               |

**主键**: (document_id, principal_type, principal_id)

### 6. document_comments - 文档评论表

存储文档评论和回复。

| 字段          | 类型             | 说明                     |
|-------------|----------------|------------------------|
| comment_id  | VARCHAR(21) PK | 评论ID                   |
| document_id | VARCHAR(21)    | 文档ID                   |
| user_id     | VARCHAR(21)    | 评论作者ID                 |
| content     | TEXT           | 评论内容                   |
| parent_id   | VARCHAR(21)    | 父评论ID（支持嵌套回复）          |
| position    | JSON           | 文档位置 {blockId, offset} |
| is_resolved | BOOLEAN        | 是否已解决                  |
| resolved_by | VARCHAR(21)    | 解决者ID                  |
| resolved_at | DATETIME       | 解决时间                   |
| created_at  | DATETIME       | 创建时间                   |
| updated_at  | DATETIME       | 更新时间                   |

### 7. groups - 权限组表

存储用户组信息。

| 字段         | 类型             | 说明    |
|------------|----------------|-------|
| group_id   | VARCHAR(21) PK | 组ID   |
| name       | VARCHAR(255)   | 组名    |
| owner_id   | VARCHAR(21)    | 所有者ID |
| created_at | DATETIME       | 创建时间  |

### 8. group_members - 组成员表

存储组与用户的关联。

| 字段        | 类型          | 说明   |
|-----------|-------------|------|
| group_id  | VARCHAR(21) | 组ID  |
| user_id   | VARCHAR(21) | 用户ID |
| joined_at | DATETIME    | 加入时间 |

**主键**: (group_id, user_id)

### 9. templates - 模板表

存储文档模板。

| 字段            | 类型             | 说明    |
|---------------|----------------|-------|
| template_id   | VARCHAR(21) PK | 模板ID  |
| title         | VARCHAR(512)   | 标题    |
| description   | VARCHAR(1024)  | 描述    |
| content       | JSON           | 模板内容  |
| category      | VARCHAR(64)    | 分类    |
| tags          | JSON           | 标签数组  |
| thumbnail_url | VARCHAR(512)   | 缩略图   |
| is_public     | BOOLEAN        | 是否公开  |
| is_official   | BOOLEAN        | 是否官方  |
| creator_id    | VARCHAR(21)    | 创建者ID |
| use_count     | INT            | 使用次数  |
| created_at    | DATETIME       | 创建时间  |
| updated_at    | DATETIME       | 更新时间  |

### 10. permission_requests - 权限申请表

存储权限申请记录。

| 字段                | 类型           | 说明                                             |
|-------------------|--------------|------------------------------------------------|
| request_id        | BIGINT PK    | 申请ID                                           |
| document_id       | VARCHAR(21)  | 文档ID                                           |
| applicant_id      | VARCHAR(21)  | 申请者ID                                          |
| target_permission | ENUM         | 申请权限                                           |
| message           | VARCHAR(512) | 申请消息                                           |
| status            | ENUM         | 状态：pending/approved/rejected/cancelled/expired |
| reviewer_id       | VARCHAR(21)  | 审批者ID                                          |
| expires_at        | DATETIME     | 过期时间                                           |
| created_at        | DATETIME     | 创建时间                                           |
| updated_at        | DATETIME     | 更新时间                                           |

### 11. notifications - 通知表

存储用户通知。

| 字段               | 类型          | 说明     |
|------------------|-------------|--------|
| notifications_id | BIGINT PK   | 通知ID   |
| request_id       | BIGINT      | 关联申请ID |
| user_id          | VARCHAR(21) | 接收者ID  |
| type             | VARCHAR(64) | 通知类型   |
| payload          | JSON        | 通知内容   |
| read_at          | DATETIME    | 阅读时间   |
| created_at       | DATETIME    | 创建时间   |

## 索引设计

### documents_info
- idx_documents_owner (owner_id)
- idx_documents_parent (parent_id)
- idx_documents_type (type)

### document_principals
- idx_doc_principal_doc (document_id)
- idx_doc_principal_type_id (principal_type, principal_id)

### document_versions
- idx_doc_versions_doc_ver (version_id DESC)

### group_members
- idx_group_members_user (user_id)

### groups
- idx_groups_owner (owner_id)

### document_comments
- idx_comments_document (document_id)
- idx_comments_user (user_id)
- idx_comments_parent (parent_id)
- idx_comments_resolved (is_resolved)
- idx_comments_created (created_at)

### templates
- idx_templates_category (category)
- idx_templates_creator (creator_id)
- idx_templates_public (is_public)
- idx_templates_official (is_official)
- idx_templates_title (title)

### permission_requests
- idx_applicant (applicant_id)
- idx_doc_status (document_id, status)
- idx_reviewer_status (reviewer_id, status)

### notifications
- idx_created (created_at)
- idx_user_read (user_id, read_at)

## 权限等级

权限级别从高到低：
1. **full** - 完全控制（包括删除、权限管理）
2. **manage** - 管理权限（分享、协作设置）
3. **edit** - 编辑权限（修改内容）
4. **comment** - 评论权限（添加评论）
5. **view** - 只读权限

权限检查逻辑：用户拥有某级别权限时，自动拥有所有更低级别权限。

## 软删除机制

- 文档使用 `is_deleted` 字段实现软删除
- 删除文件夹时，级联软删除所有子文档
- 回收站中的文档可以恢复或永久删除
- 只有软删除的文档才能永久删除

## 分享机制

- 每个文档有唯一的 `share_token`
- `link_permission` 控制分享链接权限：
  - `close` - 分享关闭
  - `view` - 只读访问
  - `edit` - 可编辑访问

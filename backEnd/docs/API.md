# CoInk API 文档

## 基础信息

- **基础URL**: `http://localhost:8888`
- **响应格式**: JSON
- **统一响应结构**:
  ```json
  {
    "code": "1",
    "message": "success",
    "data": {}
  }
  ```

## 认证模块 (/auth)

### POST /auth/register
用户注册

**请求体**:
```json
{
  "email": "user@example.com",
  "name": "用户名",
  "password": "password123"
}
```

**响应**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "xxx",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

### POST /auth/login
用户登录

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /auth/github
GitHub OAuth 登录

**请求体**:
```json
{
  "code": "github_auth_code"
}
```

### POST /auth/refresh
刷新 Token

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /auth/verify
验证 JWT Token

**请求头**:
```
Authorization: <token>
```

**响应**:
```json
{
  "valid": true,
  "payload": {
    "userId": "xxx",
    "email": "user@example.com"
  }
}
```

### POST /auth/logout
退出登录

**请求体**:
```json
{
  "userId": "xxx"
}
```

### GET /auth/profile/:userId
获取用户信息

### PATCH /auth/profile/:userId
更新用户信息

**请求体**:
```json
{
  "name": "新用户名",
  "email": "new@example.com",
  "avatarUrl": "https://..."
}
```

### PATCH /auth/profile/:userId/password
修改密码

**请求体**:
```json
{
  "oldPassword": "oldpass",
  "newPassword": "newpass"
}
```

## 文档模块 (/documents)

### POST /documents
创建文档或文件夹

**请求体**:
```json
{
  "title": "文档标题",
  "type": "FILE",
  "ownerId": "user_id",
  "parentId": "parent_folder_id",
  "isStarred": false
}
```

### GET /documents
获取我的所有文档

**查询参数**:
- `ownerId` (required): 用户ID

### GET /documents/parent
按父目录获取文档

**查询参数**:
- `parentId`: 父文件夹ID（为空表示根目录）
- `ownerId` (required): 用户ID

### GET /documents/starred
获取星标文档

**查询参数**:
- `ownerId` (required): 用户ID

### GET /documents/deleted
获取回收站文档

**查询参数**:
- `ownerId` (required): 用户ID

### GET /documents/shared/me
获取与我共享的文档

**查询参数**:
- `userId` (required): 用户ID

### GET /documents/share/:shareToken
通过分享链接获取文档

### GET /documents/:id
获取单个文档详情

### PATCH /documents/:id
更新文档

**请求体**:
```json
{
  "title": "新标题",
  "parentId": "new_parent_id",
  "isStarred": true,
  "sortOrder": 1,
  "linkPermission": "view"
}
```

### PATCH /documents/:id/rename
重命名文档

**请求体**:
```json
{
  "title": "新标题"
}
```

### PATCH /documents/:id/move
移动文档

**请求体**:
```json
{
  "parentId": "target_folder_id",
  "userId": "user_id"
}
```

### PATCH /documents/:id/star
星标/取消星标文档

**请求体**:
```json
{
  "isStarred": true
}
```

### PATCH /documents/:id/soft-delete
软删除文档（移动到回收站）

### POST /documents/:id/restore
恢复回收站文档

### DELETE /documents/:id
永久删除文档

### POST /documents/:id/share
生成分享链接

**请求体**:
```json
{
  "permission": "view"
}
```

### PATCH /documents/:id/share
关闭分享链接

### GET /documents/:id/permission
获取当前用户对文档的权限

**查询参数**:
- `userId` (required): 用户ID

**响应**:
```json
{
  "permission": "edit",
  "source": "direct"
}
```

### POST /documents/:id/permissions
设置用户权限

**请求体**:
```json
{
  "targetUserId": "target_user_id",
  "permission": "edit",
  "grantedBy": "current_user_id"
}
```

### DELETE /documents/:id/permissions
移除用户权限

**请求体**:
```json
{
  "targetUserId": "target_user_id",
  "grantedBy": "current_user_id"
}
```

## 文档内容 (/documents/:id/content)

### GET /documents/:id/content
获取文档内容

### POST /documents/:id/content
创建文档内容

**请求体**:
```json
{
  "content": { /* 文档内容 */ },
  "updatedBy": "user_id"
}
```

### PATCH /documents/:id/content
更新文档内容

**请求体**:
```json
{
  "content": { /* 文档内容 */ },
  "updatedBy": "user_id"
}
```

## 文档版本 (/documents/:id/versions)

### GET /documents/:id/versions
获取文档所有版本

### POST /documents/:id/versions
创建文档版本

**请求体**:
```json
{
  "title": "版本标题",
  "content": { /* 文档内容 */ },
  "userId": "user_id"
}
```

### GET /documents/:id/versions/:versionId
获取指定版本详情

### POST /documents/:id/versions/:versionId/restore
恢复到指定版本

## 评论模块 (/documents/:documentId/comments)

### POST /documents/:documentId/comments
创建评论

**请求体**:
```json
{
  "content": "评论内容",
  "position": {
    "blockId": "block_id",
    "offset": 0
  },
  "userId": "user_id"
}
```

### GET /documents/:documentId/comments
获取文档的所有评论

### POST /documents/:documentId/comments/:commentId/reply
回复评论

**请求体**:
```json
{
  "content": "回复内容",
  "userId": "user_id"
}
```

## 评论详情 (/comments)

### GET /comments/:commentId
获取评论详情

### PATCH /comments/:commentId
更新评论

**请求体**:
```json
{
  "content": "新内容",
  "userId": "user_id"
}
```

### DELETE /comments/:commentId
删除评论

**查询参数**:
- `userId` (required): 用户ID

### PATCH /comments/:commentId/resolve
解决评论

**请求体**:
```json
{
  "userId": "user_id"
}
```

### PATCH /comments/:commentId/unresolve
取消解决评论

**请求体**:
```json
{
  "userId": "user_id"
}
```

## 权限组模块 (/groups)

### POST /groups
创建权限组

**请求体**:
```json
{
  "name": "组名",
  "ownerId": "user_id"
}
```

### GET /groups/my
获取我加入的权限组

**查询参数**:
- `userId` (required): 用户ID

### GET /groups/owned
获取我拥有的权限组

**查询参数**:
- `userId` (required): 用户ID

### GET /groups/:id
获取权限组详情

### PATCH /groups/:id
更新权限组

**请求体**:
```json
{
  "name": "新组名",
  "userId": "user_id"
}
```

### DELETE /groups/:id
删除权限组

**查询参数**:
- `userId` (required): 用户ID

### GET /groups/:id/members
获取组成员列表

### POST /groups/:id/members
添加成员

**请求体**:
```json
{
  "targetUserId": "target_user_id",
  "userId": "current_user_id"
}
```

### DELETE /groups/:id/members/:targetUserId
移除成员

**查询参数**:
- `userId` (required): 当前用户ID

## 模板模块 (/templates)

### GET /templates
获取公开模板列表

**查询参数**:
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20)
- `category`: 分类筛选

### POST /templates
创建模板

**请求体**:
```json
{
  "title": "模板标题",
  "description": "模板描述",
  "content": { /* 模板内容 */ },
  "category": "business",
  "creatorId": "user_id"
}
```

### GET /templates/search
搜索模板

**查询参数**:
- `keyword`: 搜索关键词
- `category`: 分类
- `page`: 页码
- `limit`: 每页数量

### GET /templates/official
获取官方模板

### GET /templates/my
获取我的模板

**查询参数**:
- `creatorId` (required): 创建者ID

### GET /templates/:id
获取模板详情

### PATCH /templates/:id
更新模板

### DELETE /templates/:id
删除模板

### POST /templates/:id/generate
从模板生成文档

**请求体**:
```json
{
  "title": "文档标题",
  "ownerId": "user_id",
  "parentId": "folder_id"
}
```

## 用户模块 (/user)

### GET /user/info
获取用户信息

**查询参数**:
- `id` (required): 用户ID

### POST /user/create
创建用户

### POST /user/update
更新用户

### POST /user/delete
删除用户

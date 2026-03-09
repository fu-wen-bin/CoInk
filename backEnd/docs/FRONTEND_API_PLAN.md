# CoInk 前端API完善规划

## 项目概览

### 目标

根据后端接口文档(`backEnd/docs/API.md`)，完善前端所有服务模块，统一使用fetch API (`services/request/`)，并添加详细中文注释。

### 模块清单

共6个服务模块需要实现/重构：

| 模块             | 文件数 | API数量 | 状态 |
|----------------|-----|-------|----|
| auth (认证)      | 2   | 9     | 重构 |
| documents (文档) | 4   | 27    | 新建 |
| comments (评论)  | 2   | 8     | 新建 |
| groups (权限组)   | 2   | 9     | 新建 |
| templates (模板) | 2   | 9     | 重构 |
| users (用户)     | 2   | 4     | 完善 |

**总计**: 16个文件，66个API接口

---

## 各模块详细方案

### 1. 认证服务 (services/auth/)

**文件结构**:

```
services/auth/
├── types.ts    # 新增: 认证相关类型定义
└── index.ts    # 重构: 完善9个API方法
```

**API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /auth/register | 用户注册 |
| POST | /auth/login | 用户登录 |
| POST | /auth/github | GitHub OAuth登录 |
| POST | /auth/refresh | 刷新Token |
| GET | /auth/verify | 验证JWT Token |
| POST | /auth/logout | 退出登录 |
| GET | /auth/profile/:userId | 获取用户信息 |
| PATCH | /auth/profile/:userId | 更新用户信息 |
| PATCH | /auth/profile/:userId/password | 修改密码 |

**关键类型**:

- `RegisterParams`, `LoginParams`, `GithubLoginParams`
- `AuthResponseData`, `VerifyTokenResponseData`
- `ProfileResponseData`, `SuccessResponseData`

---

### 2. 文档服务 (services/documents/)

**文件结构**:

```
services/documents/
├── types.ts      # 新建: 所有文档相关类型
├── index.ts      # 新建: 文档管理API (20个接口)
├── content.ts    # 新建: 文档内容API (3个接口)
└── versions.ts   # 新建: 文档版本API (4个接口)
```

**API列表**:

**文档管理 (index.ts)**:
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /documents | 创建文档 |
| GET | /documents | 获取我的文档 |
| GET | /documents/parent | 按父目录获取 |
| GET | /documents/starred | 获取星标文档 |
| GET | /documents/deleted | 获取回收站 |
| GET | /documents/shared/me | 获取共享文档 |
| GET | /documents/share/:token | 通过分享链接获取 |
| GET | /documents/:id | 获取文档详情 |
| PATCH | /documents/:id | 更新文档 |
| PATCH | /documents/:id/rename | 重命名 |
| PATCH | /documents/:id/move | 移动文档 |
| PATCH | /documents/:id/star | 星标/取消星标 |
| PATCH | /documents/:id/soft-delete | 软删除 |
| POST | /documents/:id/restore | 恢复文档 |
| DELETE | /documents/:id | 永久删除 |
| POST | /documents/:id/share | 生成分享链接 |
| PATCH | /documents/:id/share | 关闭分享 |
| GET | /documents/:id/permission | 获取当前权限 |
| POST | /documents/:id/permissions | 设置权限 |
| DELETE | /documents/:id/permissions | 移除权限 |

**文档内容 (content.ts)**:
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /documents/:id/content | 获取内容 |
| POST | /documents/:id/content | 创建内容 |
| PATCH | /documents/:id/content | 更新内容 |

**文档版本 (versions.ts)**:
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /documents/:id/versions | 获取版本列表 |
| POST | /documents/:id/versions | 创建版本 |
| GET | /documents/:id/versions/:versionId | 获取版本详情 |
| POST | /documents/:id/versions/:versionId/restore | 恢复版本 |

**关键类型**:

- `Document`, `DocumentContent`, `DocumentVersion`
- `DocumentType`, `LinkPermission`, `PermissionLevel`
- `CreateDocumentParams`, `UpdateDocumentParams`
- `DocumentsListResponse`, `CurrentPermissionResponse`

---

### 3. 评论服务 (services/comments/)

**文件结构**:

```
services/comments/
├── types.ts    # 新建: 评论相关类型
└── index.ts    # 新建: 8个API方法
```

**API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /documents/:documentId/comments | 创建评论 |
| GET | /documents/:documentId/comments | 获取评论列表 |
| POST | /documents/:documentId/comments/:id/reply | 回复评论 |
| GET | /comments/:commentId | 获取评论详情 |
| PATCH | /comments/:commentId | 更新评论 |
| DELETE | /comments/:commentId | 删除评论 |
| PATCH | /comments/:commentId/resolve | 解决评论 |
| PATCH | /comments/:commentId/unresolve | 取消解决 |

**关键类型**:

- `Comment`, `CommentPosition`
- `CreateCommentRequest`, `ReplyCommentRequest`
- `UpdateCommentRequest`, `ResolveCommentRequest`

---

### 4. 权限组服务 (services/groups/)

**文件结构**:

```
services/groups/
├── types.ts    # 新建: 权限组相关类型
└── index.ts    # 新建: 9个API方法
```

**API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /groups | 创建权限组 |
| GET | /groups/my | 获取我加入的组 |
| GET | /groups/owned | 获取我拥有的组 |
| GET | /groups/:id | 获取组详情 |
| PATCH | /groups/:id | 更新组 |
| DELETE | /groups/:id | 删除组 |
| GET | /groups/:id/members | 获取成员列表 |
| POST | /groups/:id/members | 添加成员 |
| DELETE | /groups/:id/members/:targetUserId | 移除成员 |

**关键类型**:

- `Group`, `GroupMember`
- `CreateGroupRequest`, `UpdateGroupRequest`
- `AddMemberRequest`, `GroupsListResponse`

---

### 5. 模板服务 (services/templates/)

**文件结构**:

```
services/templates/
├── types.ts    # 新建: 模板相关类型(从types/templates迁移)
└── index.ts    # 重构: 迁移到fetch API
```

**API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /templates | 获取公开模板 |
| POST | /templates | 创建模板 |
| GET | /templates/search | 搜索模板 |
| GET | /templates/official | 获取官方模板 |
| GET | /templates/my | 获取我的模板 |
| GET | /templates/:id | 获取模板详情 |
| PATCH | /templates/:id | 更新模板 |
| DELETE | /templates/:id | 删除模板 |
| POST | /templates/:id/generate | 从模板生成文档 |

**关键类型**:

- `Template`, `TemplateCategory`
- `CreateTemplateParams`, `UpdateTemplateParams`
- `SearchTemplatesParams`, `TemplatesListResponse`
- `GenerateFromTemplateParams`

**迁移要点**:

- 从 `@/lib/http` (axios) 迁移到 `services/request/client` (fetch)
- 返回格式从直接返回数据改为 `{ data, error, status }`
- 添加详细中文注释

---

### 6. 用户服务 (services/users/)

**文件结构**:

```
services/users/
├── types.ts    # 新建: 用户相关类型
└── index.ts    # 修改完善: 4个核心API + 2个兼容API
```

**API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /user/info | 获取用户信息 |
| POST | /user/create | 创建用户 |
| POST | /user/update | 更新用户 |
| POST | /user/delete | 删除用户 |

**兼容API(保留)**:

- `searchUsers` - 搜索用户
- `getUserById` - 通过ID获取用户

**关键类型**:

- `User` (更新为与后端一致的userId: string)
- `CreateUserRequest`, `UpdateUserRequest`, `DeleteUserRequest`
- `UserResponse`, `UserListResponse`

**重要变更**:

- User类型从 `id: number` 改为 `userId: string` (nanoid)
- 使用新版 `clientRequest` 替代旧版request

---

## 技术规范

### 1. HTTP客户端使用

```typescript
// 统一导入
import { clientRequest, ErrorHandler } from '@/services/request';
import type { RequestResult } from '@/services/request';

// GET请求
const { data, error } = await clientRequest.get<T>('/api/v1/xxx', {
  params: { key: value },
  errorHandler,
});

// POST请求
const { data, error } = await clientRequest.post<T>('/api/v1/xxx', {
  params: requestBody,
  errorHandler,
});
```

### 2. 返回格式

统一返回 `RequestResult<T>`:

```typescript
{
  data: ApiResponse<T> | null;  // { code, message, data, timestamp }
  error: string | null;
  status ? : number;
}
```

使用示例:

```typescript
const { data, error } = await api.method(params);

if (error) {
  console.error('请求失败:', error);
  return;
}

if (data?.code !== 200) {
  console.error('业务错误:', data?.message);
  return;
}

const result = data.data; // 实际业务数据
```

### 3. 注释规范

每个文件头部:

```typescript
/**
 * {模块名}服务 API
 *
 * 功能说明：
 * - {功能点1}
 * - {功能点2}
 *
 * 后端接口文档：backEnd/docs/API.md
 */
```

每个方法:

```typescript
/**
 * {方法说明}
 *
 * @param {参数名} - {参数说明}
 * @param errorHandler - 可选的错误处理函数
 * @returns {返回值说明}
 *
 * @example
 * ```typescript
 * const { data, error } = await apiName(params);
 * if (error) {
 *   console.error(error);
 *   return;
 * }
 * // 处理 data.data
 * ```

*/

```

### 4. 导出规范

```typescript
// API对象
export const {module}Api = { ... };

// 默认导出
export default {module}Api;

// 类型导出
export * from './types';
```

---

## 扩展功能预留规划

### 1. 协同编辑服务 (Yjs + Hocuspocus)

**位置**: `services/collaboration/`

**文件结构**:

```
services/collaboration/
├── types.ts           # 协同编辑类型定义
├── yjs.ts             # Yjs文档操作封装
├── hocuspocus.ts      # Hocuspocus WebSocket连接管理
├── awareness.ts       # 用户感知状态管理 (光标、选区)
└── index.ts           # 统一导出
```

**预留类型定义**:

```typescript
// types.ts

/**
 * 协同编辑用户状态
 */
export interface AwarenessUser {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  name: string;
  /** 头像 */
  avatar?: string;
  /** 光标位置 */
  cursor?: {
    anchor: number;
    head: number;
  };
  /** 用户颜色 */
  color: string;
}

/**
 * Hocuspocus连接配置
 */
export interface HocuspocusConfig {
  /** WebSocket服务器地址 */
  url: string;
  /** 文档ID */
  documentId: string;
  /** 认证token */
  token: string;
  /** 重连配置 */
  reconnect?: {
    maxAttempts: number;
    delay: number;
  };
}

/**
 * Yjs文档更新事件
 */
export interface YjsUpdateEvent {
  /** 更新数据 (Uint8Array) */
  update: Uint8Array;
  /** 更新来源 */
  origin: 'local' | 'remote';
  /** 文档版本 */
  version: number;
}
```

**预留API列表**:
| 方法 | 说明 |
|------|------|
| `connect(config)` | 建立WebSocket连接 |
| `disconnect()` | 断开连接 |
| `getDocument()` | 获取Yjs文档实例 |
| `getAwareness()` | 获取用户感知状态 |
| `updateCursor(position)` | 更新光标位置 |
| `destroy()` | 销毁资源 |

**后端预留**:

- WebSocket端点: `ws://localhost:1234` (Hocuspocus默认)
- 需要添加Hocuspocus服务器到backEnd

---

### 2. 聊天侧边栏服务

**位置**: `services/chat/`

**文件结构**:

```
services/chat/
├── types.ts           # 聊天类型定义
├── index.ts           # 聊天API
├── realtime.ts        # 实时消息(WebSocket/SSE)
└── ai.ts              # AI助手对话
```

**预留类型定义**:

```typescript
// types.ts

/**
 * 聊天消息类型
 */
export type MessageType = 'text' | 'image' | 'file' | 'ai' | 'system';

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息ID */
  messageId: string;
  /** 所属文档ID */
  documentId: string;
  /** 发送者ID (AI为'ai') */
  senderId: string;
  /** 发送者名称 */
  senderName: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容 */
  content: string;
  /** 引用的文档内容 */
  quote?: {
    blockId: string;
    text: string;
  };
  /** 创建时间 */
  createdAt: string;
}

/**
 * AI助手请求
 */
export interface AIAssistantRequest {
  /** 文档ID */
  documentId: string;
  /** 用户消息 */
  message: string;
  /** 选中的文档内容上下文 */
  context?: string;
  /** 会话历史 */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * AI助手响应 (流式)
 */
export interface AIAssistantResponse {
  /** 消息ID */
  messageId: string;
  /** 流式内容块 */
  chunk: string;
  /** 是否结束 */
  done: boolean;
}
```

**预留API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| `getMessages(documentId)` | GET /chat/:documentId/messages | 获取聊天历史 |
| `sendMessage(data)` | POST /chat/:documentId/messages | 发送消息 |
| `deleteMessage(messageId)` | DELETE /chat/messages/:id | 删除消息 |
| `askAI(data)` | POST /chat/ai/ask | 询问AI助手 (流式) |
| `subscribeMessages(documentId, callback)` | WebSocket | 订阅实时消息 |

**后端预留**:

- REST API: `/chat/*`
- WebSocket: 实时消息推送
- AI集成: OpenAI/Claude API

---

### 3. AI划词编辑服务

**位置**: `services/ai/`

**文件结构**:

```
services/ai/
├── types.ts           # AI功能类型定义
├── index.ts           # AI API封装
├── selection.ts       # 划词选区管理
└── prompts.ts         # AI提示词模板
```

**预留类型定义**:

```typescript
// types.ts

/**
 * AI操作类型
 */
export type AIOperation =
  | 'continue'      // 续写
  | 'rewrite'       // 改写
  | 'polish'        // 润色
  | 'summarize'     // 总结
  | 'translate'     // 翻译
  | 'comment'       // 智能评论
  | 'ask';          // 问答

/**
 * AI请求参数
 */
export interface AIRequest {
  /** 操作类型 */
  operation: AIOperation;
  /** 选中的文本 */
  selectedText: string;
  /** 文档上下文 */
  context?: string;
  /** 目标语言 (翻译用) */
  targetLang?: string;
  /** 语气风格 (改写用) */
  tone?: 'formal' | 'casual' | 'professional';
  /** 自定义提示词 */
  customPrompt?: string;
}

/**
 * AI响应
 */
export interface AIResponse {
  /** 生成的内容 */
  content: string;
  /** 操作类型 */
  operation: AIOperation;
  /** 替换范围 (用于划词替换) */
  range?: {
    from: number;
    to: number;
  };
}

/**
 * 智能评论
 */
export interface AIComment {
  /** 评论ID */
  commentId: string;
  /** 关联的文档位置 */
  position: {
    blockId: string;
    start: number;
    end: number;
  };
  /** 选中的原文 */
  originalText: string;
  /** AI建议 */
  suggestion: string;
  /** 建议类型 */
  type: 'grammar' | 'style' | 'clarity' | 'idea';
  /** 创建时间 */
  createdAt: string;
}

/**
 * 划词菜单配置
 */
export interface SelectionMenuItem {
  /** 菜单项ID */
  id: AIOperation;
  /** 显示名称 */
  label: string;
  /** 图标 */
  icon: string;
  /** 快捷键 */
  shortcut?: string;
}
```

**预留API列表**:
| 方法 | 端点 | 说明 |
|------|------|------|
| `generate(request)` | POST /ai/generate | 通用AI生成 |
| `continueWriting(context)` | POST /ai/continue | 续写 |
| `rewrite(text, tone)` | POST /ai/rewrite | 改写 |
| `polish(text)` | POST /ai/polish | 润色 |
| `translate(text, targetLang)` | POST /ai/translate | 翻译 |
| `analyzeSelection(text, context)` | POST /ai/analyze | 智能评论分析 |
| `acceptSuggestion(commentId)` | POST /ai/comments/:id/accept | 接受AI建议 |
| `dismissSuggestion(commentId)` | DELETE /ai/comments/:id | 忽略AI建议 |

**划词菜单配置**:

```typescript
// 默认划词菜单项
export const DEFAULT_SELECTION_MENU: SelectionMenuItem[] = [
  { id: 'continue', label: '续写', icon: 'Sparkles', shortcut: '⌘+K C' },
  { id: 'rewrite', label: '改写', icon: 'RefreshCw', shortcut: '⌘+K R' },
  { id: 'polish', label: '润色', icon: 'Wand2', shortcut: '⌘+K P' },
  { id: 'summarize', label: '总结', icon: 'FileText', shortcut: '⌘+K S' },
  { id: 'translate', label: '翻译', icon: 'Languages', shortcut: '⌘+K T' },
  { id: 'comment', label: '智能评论', icon: 'MessageSquare', shortcut: '⌘+K M' },
  { id: 'ask', label: '询问AI', icon: 'Bot', shortcut: '⌘+K A' },
];
```

**后端预留**:

- REST API: `/ai/*`
- AI Provider: OpenAI API / Azure OpenAI / Claude
- 流式响应: SSE (Server-Sent Events)

---

## 扩展功能服务架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            前端 (coInk)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   services   │  │   services   │  │   services   │  │   services   │    │
│  │     /ai      │  │    /chat     │  │/collaboration│  │   /request   │    │
│  │              │  │              │  │              │  │              │    │
│  │ • 续写/改写  │  │ • 聊天消息   │  │ • Yjs文档   │  │ • HTTP请求   │    │
│  │ • 智能评论   │  │ • AI助手     │  │ • 光标同步   │  │ • Token刷新  │    │
│  │ • 划词菜单   │  │ • 实时消息   │  │ • 用户感知   │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                                    │                                        │
│                           ┌────────┴────────┐                               │
│                           │  components/ui  │                               │
│                           │  • 划词菜单组件  │                               │
│                           │  • 聊天侧边栏   │                               │
│                           │  • 光标/选区UI  │                               │
│                           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            后端 (backEnd)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      HTTP REST API (NestJS)                        │   │
│  │  /ai/*  /chat/*  /auth/*  /documents/*  /comments/*  /groups/*     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐ │
│  │                                 ▼                                     │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │ │
│  │  │   Hocuspocus     │  │   AI Service     │  │   Chat Service   │   │ │
│  │  │   WebSocket      │  │   (OpenAI API)   │  │   (WebSocket)    │   │ │
│  │  │                  │  │                  │  │                  │   │ │
│  │  │ • Yjs文档同步    │  │ • 文本生成       │  │ • 实时消息       │   │ │
│  │  │ •  awareness     │  │ • 流式响应       │  │ • 消息历史       │   │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 扩展功能开发优先级建议

### Phase 1 (当前): 基础API完善

- [x] 认证服务
- [x] 文档服务
- [x] 评论服务
- [x] 权限组服务
- [x] 模板服务
- [x] 用户服务

### Phase 2: 协同编辑

- [ ] 后端部署Hocuspocus服务器
- [ ] 前端集成Yjs
- [ ] 光标同步
- [ ] 用户感知状态

### Phase 3: AI功能

- [ ] 接入OpenAI API
- [ ] 划词菜单组件
- [ ] 续写/改写功能
- [ ] 智能评论

### Phase 4: 聊天功能

- [ ] 聊天侧边栏UI
- [ ] WebSocket实时消息
- [ ] AI助手集成

---

## 验收标准

### 基础功能

- [ ] 所有16个基础文件创建/修改完成
- [ ] 所有66个基础API方法实现
- [ ] 详细的中文注释和API文档
- [ ] TypeScript类型检查通过
- [ ] ESLint检查通过
- [ ] 旧代码清理完成

### 扩展功能预留

- [ ] 协同编辑服务目录结构创建
- [ ] 聊天服务目录结构创建
- [ ] AI服务目录结构创建
- [ ] 扩展功能类型定义文件创建

/**
 * 聊天服务类型定义
 *
 * 功能说明：
 * - 文档聊天消息类型
 * - AI助手对话类型
 * - 实时消息订阅
 *
 * @todo Phase 4: 实现聊天侧边栏功能
 */

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
  /** 发送者头像 */
  senderAvatar?: string;
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
  /** 更新时间 */
  updatedAt?: string;
}

/**
 * 发送消息请求
 */
export interface SendMessageRequest {
  /** 消息内容 */
  content: string;
  /** 消息类型 */
  type?: MessageType;
  /** 引用的文档内容 */
  quote?: {
    blockId: string;
    text: string;
  };
}

/**
 * 获取消息列表响应
 */
export interface GetMessagesResponse {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 总数 */
  total: number;
  /** 是否有更多 */
  hasMore: boolean;
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

/**
 * 聊天会话
 */
export interface ChatSession {
  /** 会话ID */
  sessionId: string;
  /** 文档ID */
  documentId: string;
  /** 用户ID */
  userId: string;
  /** 会话标题 */
  title: string;
  /** 最后一条消息 */
  lastMessage?: ChatMessage;
  /** 未读消息数 */
  unreadCount: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

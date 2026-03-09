/**
 * 协同编辑服务类型定义
 *
 * 功能说明：
 * - Yjs文档协同编辑类型
 * - Hocuspocus WebSocket连接配置
 * - 用户感知状态 (光标、选区)
 *
 * 后端服务: Hocuspocus WebSocket Server
 * @todo Phase 2: 实现协同编辑功能
 */

/**
 * 协同编辑用户状态
 * 用于显示其他用户的光标位置和选区
 */
export interface AwarenessUser {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  name: string;
  /** 头像URL */
  avatarUrl?: string;
  /** 光标位置信息 */
  cursor?: {
    /** 锚点位置 */
    anchor: number;
    /** 头部位置 */
    head: number;
  };
  /** 用户颜色 (用于区分不同用户) */
  color: string;
  /** 当前选中的块ID */
  selectedBlockId?: string;
}

/**
 * Hocuspocus WebSocket连接配置
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
    /** 最大重连次数 */
    maxAttempts: number;
    /** 重连延迟(毫秒) */
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

/**
 * 协同编辑连接状态
 */
export type CollaborationStatus =
  | 'connecting' // 连接中
  | 'connected' // 已连接
  | 'reconnecting' // 重连中
  | 'disconnected' // 已断开
  | 'error'; // 连接错误

/**
 * 协同编辑事件回调
 */
export interface CollaborationCallbacks {
  /** 连接成功回调 */
  onConnect?: () => void;
  /** 断开连接回调 */
  onDisconnect?: () => void;
  /** 用户状态变化回调 */
  onAwarenessChange?: (users: AwarenessUser[]) => void;
  /** 同步状态变化回调 */
  onSync?: (status: 'syncing' | 'synced') => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

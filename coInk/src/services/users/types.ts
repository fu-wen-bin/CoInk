/**
 * 用户服务类型定义
 *
 * 功能说明：
 * - 定义用户相关的所有类型接口
 * - 与后端API文档保持一致
 * - 使用 userId: string 作为主键（nanoid格式）
 *
 * 后端接口文档：backEnd/docs/API.md
 */

/**
 * 用户对象
 * 表示一个用户的完整信息
 * 注意：使用 userId (string) 作为唯一标识，不是 id (number)
 */
export interface User {
  /** 用户唯一标识符（nanoid格式） */
  userId: string;
  /** 用户姓名 */
  name: string;
  /** 用户邮箱 */
  email?: string | null;
  /** 用户头像URL */
  avatarUrl?: string | null;
  /** 个人简介 */
  bio?: string | null;
  /** 所在公司 */
  company?: string | null;
  /** 所在地区 */
  location?: string | null;
  /** 个人网站 */
  websiteUrl?: string | null;
  /** GitHub用户ID */
  githubId?: string | null;
  /** GitHub用户名 */
  githubUsername?: string | null;
  /** 用户角色 */
  role: string;
  /** 是否激活 */
  isActive?: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 最后登录时间 */
  lastLoginAt?: string | null;
}

/**
 * 创建用户请求参数
 * 用于管理员创建新用户
 */
export interface CreateUserRequest {
  /** 用户姓名（必填） */
  name: string;
  /** 用户邮箱 */
  email?: string;
  /** 用户密码（必填） */
  password: string;
  /** 用户头像URL */
  avatarUrl?: string;
  /** 个人简介 */
  bio?: string;
  /** 所在公司 */
  company?: string;
  /** 所在地区 */
  location?: string;
  /** 个人网站 */
  websiteUrl?: string;
  /** 用户角色 */
  role?: string;
}

/**
 * 更新用户请求参数
 * 所有字段均为可选，只更新提供的字段
 */
export interface UpdateUserRequest {
  /** 用户ID（必填） */
  userId: string;
  /** 用户姓名 */
  name?: string;
  /** 用户邮箱 */
  email?: string | null;
  /** 用户头像URL */
  avatarUrl?: string | null;
  /** 个人简介 */
  bio?: string | null;
  /** 所在公司 */
  company?: string | null;
  /** 所在地区 */
  location?: string | null;
  /** 个人网站 */
  websiteUrl?: string | null;
  /** 用户角色 */
  role?: string;
}

/**
 * 删除用户请求参数
 */
export interface DeleteUserRequest {
  /** 要删除的用户ID（必填） */
  userId: string;
}

/**
 * 获取用户信息请求参数
 */
export interface GetUserInfoRequest {
  /** 用户ID（必填） */
  userId: string;
}

/**
 * 单个用户响应
 */
export interface UserResponse {
  /** 用户信息 */
  user: User;
  /** 响应时间戳 */
  timestamp: number;
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  /** 用户列表 */
  users: User[];
  /** 总数 */
  total: number;
  /** 响应时间戳 */
  timestamp: number;
}

/**
 * 图片上传响应
 */
export interface ImageUploadResponse {
  /** 文件URL */
  fileUrl: string;
  /** 文件哈希 */
  fileHash: string;
  /** 处理后文件名 */
  processedFileName: string;
  /** 原始MIME类型 */
  originalMimeType: string;
  /** 处理后MIME类型 */
  processedMimeType: string;
  /** ImageKit文件ID */
  imageKitFileId: string;
}

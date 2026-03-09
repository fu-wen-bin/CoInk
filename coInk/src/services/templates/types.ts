/**
 * 模板服务类型定义
 *
 * 功能说明：
 * - 定义模板相关的所有类型接口
 * - 包含模板创建、更新、搜索、生成文档等参数类型
 * - 与后端API文档保持一致
 *
 * 后端接口文档：backEnd/docs/API.md
 */

/**
 * 模板对象
 * 表示一个文档模板的完整信息
 */
export interface Template {
  /** 模板唯一标识符 */
  templateId: string;
  /** 模板标题 */
  title: string;
  /** 模板描述 */
  description?: string;
  /** 模板内容（TipTap JSON格式） */
  content: Record<string, unknown>;
  /** 模板分类 */
  category: string;
  /** 标签列表 */
  tags?: string[];
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 是否公开 */
  isPublic: boolean;
  /** 是否官方模板 */
  isOfficial: boolean;
  /** 创建者ID */
  creatorId: string;
  /** 使用次数 */
  useCount: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 模板分类
 */
export interface TemplateCategory {
  /** 分类ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description?: string;
  /** 分类图标 */
  icon?: string;
}

/**
 * 创建模板请求参数
 */
export interface CreateTemplateParams {
  /** 模板标题（必填） */
  title: string;
  /** 模板描述 */
  description?: string;
  /** 模板内容（TipTap JSON格式，必填） */
  content: Record<string, unknown>;
  /** 模板分类（必填） */
  category: string;
  /** 标签列表 */
  tags?: string[];
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 是否公开（默认false） */
  isPublic?: boolean;
  /** 创建者ID（必填） */
  creatorId: string;
}

/**
 * 更新模板请求参数
 * 所有字段均为可选，只更新提供的字段
 */
export interface UpdateTemplateParams {
  /** 模板标题 */
  title?: string;
  /** 模板描述 */
  description?: string;
  /** 模板内容（TipTap JSON格式） */
  content?: Record<string, unknown>;
  /** 模板分类 */
  category?: string;
  /** 标签列表 */
  tags?: string[];
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 是否公开 */
  isPublic?: boolean;
}

/**
 * 搜索模板请求参数
 */
export interface SearchTemplatesParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 分类筛选 */
  category?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 页码（默认1） */
  page?: number;
  /** 每页数量（默认20） */
  limit?: number;
}

/**
 * 从模板生成文档请求参数
 */
export interface GenerateFromTemplateParams {
  /** 新文档标题（可选，默认使用模板标题） */
  title?: string;
  /** 父文件夹ID（可选） */
  parentId?: string;
  /** 文档所有者ID（必填） */
  ownerId: string;
}

/**
 * 模板列表响应
 */
export interface TemplatesListResponse {
  /** 模板列表 */
  templates: Template[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
}

/**
 * 从模板生成文档的响应
 */
export interface GenerateDocumentResponse {
  /** 新创建的文档ID */
  documentId: string;
  /** 新文档标题 */
  title: string;
}

/**
 * 获取模板列表通用参数
 */
export interface GetTemplatesParams {
  /** 页码（默认1） */
  page?: number;
  /** 每页数量（默认20） */
  limit?: number;
  /** 分类筛选 */
  category?: string;
}

/**
 * 获取我的模板列表参数
 */
export interface GetMyTemplatesParams {
  /** 创建者ID（必填） */
  creatorId: string;
  /** 页码（默认1） */
  page?: number;
  /** 每页数量（默认20） */
  limit?: number;
}

/**
 * 模板类型定义
 */

export interface Template {
  templateId: string;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  category: string;
  tags?: string[];
  thumbnailUrl?: string;
  isPublic: boolean;
  isOfficial: boolean;
  creatorId: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface CreateTemplateParams {
  title: string;
  description?: string;
  content: Record<string, unknown>;
  category: string;
  tags?: string[];
  thumbnailUrl?: string;
  isPublic?: boolean;
  creatorId: string;
}

export interface UpdateTemplateParams {
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  isPublic?: boolean;
}

export interface SearchTemplatesParams {
  keyword?: string;
  category?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface GenerateFromTemplateParams {
  title?: string;
  parentId?: string;
  ownerId: string;
}

export interface TemplatesListResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
}

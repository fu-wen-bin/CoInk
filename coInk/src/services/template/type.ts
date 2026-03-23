// import { JSONContent } from '@tiptap/core';

export enum TemplateCategory {
  TECH = 'TECH', // 技术
  BUSINESS = 'BUSINESS', // 商务
  PROJECT = 'PROJECT', // 项目
  EDUCATION = 'EDUCATION', // 教育
  PRODUCT = 'PRODUCT', // 产品
  DESIGN = 'DESIGN', // 设计
}

export interface CreateTemplate {
  name: string;
  description: string;
  content: string;
  tags: string;
  category?: TemplateCategory;
}

export type UpdateTemplate = Partial<CreateTemplate>;

export interface TemplateResponse {
  id: number;
  name: string;
  description: string;
  content: string;
  tags: string;
  category: TemplateCategory;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean;
}

export interface ProjectorIntroduction {
  /** TipTap JSON 文档或 HTML 字符串；部分接口会把文档放在 `default` */
  content?: string | Record<string, unknown>;
  default?: string | Record<string, unknown>;
}

export interface QueryTemplate {
  name?: string;
  category?: TemplateCategory;
}

export interface TemplateListData {
  list: TemplateResponse[];
  total: number;
}

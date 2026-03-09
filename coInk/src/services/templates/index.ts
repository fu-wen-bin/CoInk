/**
 * 模板服务 API
 *
 * 功能说明：
 * - 模板创建、查询、更新、删除
 * - 模板搜索和筛选
 * - 官方模板和公开模板获取
 * - 从模板生成文档
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  CreateTemplateParams,
  GenerateDocumentResponse,
  GenerateFromTemplateParams,
  GetMyTemplatesParams,
  GetTemplatesParams,
  SearchTemplatesParams,
  Template,
  TemplateCategory,
  TemplatesListResponse,
  UpdateTemplateParams,
} from './types';

import { clientRequest, ErrorHandler } from '@/services/request';
import type { RequestResult } from '@/services/request';

/**
 * 模板服务 API 对象
 * 提供模板相关的所有后端接口调用
 */
export const templatesApi = {
  /**
   * 创建模板
   * 创建一个新的文档模板
   *
   * @param data - 创建模板参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 创建成功的模板对象
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.createTemplate({
   *   title: '会议纪要模板',
   *   description: '标准会议纪要格式',
   *   content: { /* TipTap JSON * / },
   *   category: 'business',
   *   creatorId: 'user_xxx'
   * });
   * if (error) {
   *   console.error('创建失败:', error);
   *   return;
   * }
   * console.log('模板创建成功:', data?.data);
   * ```
   */
  createTemplate: (
    data: CreateTemplateParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Template>> =>
    clientRequest.post<Template>('/templates', {
      params: data,
      errorHandler,
    }),

  /**
   * 获取公开模板列表
   * 获取所有公开的模板（包括官方和非官方）
   *
   * @param params - 分页和分类筛选参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 模板列表和总数
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.getTemplates({
   *   page: 1,
   *   limit: 20,
   *   category: 'business'
   * });
   * if (error) {
   *   console.error('获取失败:', error);
   *   return;
   * }
   * console.log('模板列表:', data?.data?.templates);
   * ```
   */
  getTemplates: (
    params?: GetTemplatesParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<TemplatesListResponse>> =>
    clientRequest.get<TemplatesListResponse>('/templates', {
      params,
      errorHandler,
    }),

  /**
   * 搜索模板
   * 根据关键词、分类、标签搜索模板
   *
   * @param params - 搜索参数（关键词、分类、标签、分页）
   * @param errorHandler - 可选的错误处理函数
   * @returns 匹配的模板列表
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.searchTemplates({
   *   keyword: '会议',
   *   category: 'business',
   *   page: 1,
   *   limit: 10
   * });
   * if (error) {
   *   console.error('搜索失败:', error);
   *   return;
   * }
   * console.log('搜索结果:', data?.data?.templates);
   * ```
   */
  searchTemplates: (
    params: SearchTemplatesParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<TemplatesListResponse>> =>
    clientRequest.get<TemplatesListResponse>('/templates/search', {
      params,
      errorHandler,
    }),

  /**
   * 获取官方推荐模板
   * 获取系统官方推荐的优质模板
   *
   * @param params - 分页参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 官方模板列表
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.getOfficialTemplates({
   *   page: 1,
   *   limit: 10
   * });
   * if (error) {
   *   console.error('获取失败:', error);
   *   return;
   * }
   * console.log('官方模板:', data?.data?.templates);
   * ```
   */
  getOfficialTemplates: (
    params?: Omit<GetTemplatesParams, 'category'>,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<TemplatesListResponse>> =>
    clientRequest.get<TemplatesListResponse>('/templates/official', {
      params,
      errorHandler,
    }),

  /**
   * 获取我的模板列表
   * 获取当前用户创建的所有模板
   *
   * @param params - 创建者ID和分页参数
   * @param errorHandler - 可选的错误处理函数
   * @returns 用户的模板列表
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.getMyTemplates({
   *   creatorId: 'user_xxx',
   *   page: 1,
   *   limit: 20
   * });
   * if (error) {
   *   console.error('获取失败:', error);
   *   return;
   * }
   * console.log('我的模板:', data?.data?.templates);
   * ```
   */
  getMyTemplates: (
    params: GetMyTemplatesParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<TemplatesListResponse>> =>
    clientRequest.get<TemplatesListResponse>('/templates/my', {
      params,
      errorHandler,
    }),

  /**
   * 获取模板详情
   * 根据ID获取单个模板的详细信息
   *
   * @param id - 模板ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 模板详情
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.getTemplate('template_xxx');
   * if (error) {
   *   console.error('获取失败:', error);
   *   return;
   * }
   * console.log('模板详情:', data?.data);
   * ```
   */
  getTemplate: (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<Template>> =>
    clientRequest.get<Template>(`/templates/${id}`, {
      errorHandler,
    }),

  /**
   * 更新模板
   * 更新指定模板的信息（仅创建者可更新）
   *
   * @param id - 模板ID
   * @param data - 更新参数（部分字段）
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的模板
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.updateTemplate('template_xxx', {
   *   title: '新标题',
   *   description: '新描述'
   * });
   * if (error) {
   *   console.error('更新失败:', error);
   *   return;
   * }
   * console.log('更新成功:', data?.data);
   * ```
   */
  updateTemplate: (
    id: string,
    data: UpdateTemplateParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Template>> =>
    clientRequest.patch<Template>(`/templates/${id}`, {
      params: data,
      errorHandler,
    }),

  /**
   * 删除模板
   * 删除指定模板（仅创建者可删除）
   *
   * @param id - 模板ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 删除结果
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.deleteTemplate('template_xxx');
   * if (error) {
   *   console.error('删除失败:', error);
   *   return;
   * }
   * console.log('删除成功');
   * ```
   */
  deleteTemplate: (id: string, errorHandler?: ErrorHandler): Promise<RequestResult<void>> =>
    clientRequest.delete<void>(`/templates/${id}`, {
      errorHandler,
    }),

  /**
   * 从模板生成文档
   * 使用指定模板创建一个新文档
   *
   * @param id - 模板ID
   * @param data - 生成参数（标题、父文件夹、所有者）
   * @param errorHandler - 可选的错误处理函数
   * @returns 新创建的文档ID和标题
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.generateFromTemplate('template_xxx', {
   *   title: '我的会议纪要',
   *   ownerId: 'user_xxx',
   *   parentId: 'folder_xxx'
   * });
   * if (error) {
   *   console.error('生成失败:', error);
   *   return;
   * }
   * console.log('文档创建成功:', data?.data?.documentId);
   * ```
   */
  generateFromTemplate: (
    id: string,
    data: GenerateFromTemplateParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<GenerateDocumentResponse>> =>
    clientRequest.post<GenerateDocumentResponse>(`/templates/${id}/generate`, {
      params: data,
      errorHandler,
    }),

  /**
   * 获取模板分类列表
   * 获取所有可用的模板分类
   *
   * @param errorHandler - 可选的错误处理函数
   * @returns 分类列表
   *
   * @example
   * ```typescript
   * const { data, error } = await templatesApi.getCategories();
   * if (error) {
   *   console.error('获取失败:', error);
   *   return;
   * }
   * console.log('分类列表:', data?.data);
   * ```
   */
  getCategories: (errorHandler?: ErrorHandler): Promise<RequestResult<TemplateCategory[]>> =>
    clientRequest.get<TemplateCategory[]>('/templates/categories', {
      errorHandler,
    }),
};

/**
 * 默认导出模板API
 */
export default templatesApi;

/**
 * 导出所有类型定义
 */
export * from './types';

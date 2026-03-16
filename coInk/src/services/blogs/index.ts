import { serverRequest, clientRequest } from '../request';
import type { BlogPost, BlogListResponse, GetAllBlogsParams, CreateBlogParams } from './type';

export const blogsServerApi = {
  /** 获取所有博客列表 */
  getAll: (params?: GetAllBlogsParams) =>
    serverRequest.get<BlogListResponse>('/blog', {
      params,
      cacheTime: 0, // 不缓存，确保数据最新
    }),

  /** 获取博客详情 */
  getInfo: (id: number) =>
    serverRequest.get<BlogPost>(`/blog/${id}`, {
      cacheTime: 0,
    }),
};

export const blogsClientApi = {
  /** 创建博客（需要认证） */
  create: (data: CreateBlogParams) => clientRequest.post<BlogPost>('/blog', { params: data }),

  // 获取当前用户的博客列表
  getMyBlogs: (params: GetAllBlogsParams) =>
    clientRequest.get<BlogListResponse>('/blog/my-blogs', {
      params,
      cacheTime: 0, // 不缓存，确保数据最新
    }),

  /** 删除博客 */
  delete: (id: number) => clientRequest.delete(`/blog/${id}`),
};

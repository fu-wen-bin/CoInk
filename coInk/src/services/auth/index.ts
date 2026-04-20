/**
 * 认证服务 API
 *
 * 功能说明：
 * - 用户注册、登录、登出
 * - Token 刷新与验证
 * - 用户信息管理（获取、更新、修改密码）
 * - GitHub OAuth 登录
 *
 * 后端接口文档：backEnd/docs/API.md
 */

import type {
  EmailCodeLoginParams,
  RegisterParams,
  LoginParams,
  SendEmailCodeParams,
  SendEmailCodeResponseData,
  GithubLoginParams,
  RefreshTokenParams,
  LogoutParams,
  UpdateProfileParams,
  ChangePasswordParams,
  AuthResponseData,
  VerifyTokenResponseData,
  ProfileResponseData,
  SuccessResponseData,
  TokenRefreshResponseData,
} from './types';

import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

/**
 * 认证服务 API 对象
 *
 * 包含所有与认证相关的 API 方法：
 * - 注册、登录、登出
 * - Token 管理
 * - 用户信息管理
 */
export const authApi = {
  /**
   * 用户注册
   *
   * 接口路径：POST /auth/register
   * 功能描述：使用邮箱、用户名和密码注册新用户
   *
   * @param params - 注册参数，包含 email, name, password
   * @param errorHandler - 可选的错误处理函数
   * @returns 认证响应数据，包含 accessToken, refreshToken 和用户信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.register({
   *   email: 'user@example.com',
   *   name: '张三',
   *   password: 'password123'
   * });
   *
   * if (error) {
   *   console.error('注册失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('注册成功:', data.data.user);
   *   // 保存 token
   *   localStorage.setItem('token', data.data.accessToken);
   * }
   * ```
   */
  register: (
    params: RegisterParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<AuthResponseData>> =>
    clientRequest.post<AuthResponseData>('/auth/register', {
      params,
      errorHandler,
      timeout: 30000,
      retries: 0,
    }),

  /**
   * 用户登录
   *
   * 接口路径：POST /auth/login
   * 功能描述：使用邮箱和密码登录
   *
   * @param params - 登录参数，包含 email 和 password
   * @param errorHandler - 可选的错误处理函数
   * @returns 认证响应数据，包含 accessToken, refreshToken 和用户信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.login({
   *   email: 'user@example.com',
   *   password: 'password123'
   * });
   *
   * if (error) {
   *   console.error('登录失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('登录成功:', data.data.user);
   *   // 保存 token 到 cookie（自动处理）
   * }
   * ```
   */
  login: (
    params: LoginParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<AuthResponseData>> =>
    clientRequest.post<AuthResponseData>('/auth/login', {
      params,
      skipAuthRefresh: true,
      errorHandler,
    }),

  /**
   * 发送邮箱验证码
   *
   * 接口路径：POST /auth/email-code/send
   *
   * @param params - 发送参数，包含 email
   * @param errorHandler - 可选的错误处理函数
   */
  sendEmailCode: (
    params: SendEmailCodeParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<SendEmailCodeResponseData>> =>
    clientRequest.post<SendEmailCodeResponseData>('/auth/email-code/send', {
      params,
      errorHandler,
      timeout: 30000,
      retries: 0,
    }),

  /**
   * 邮箱验证码登录（首次自动注册）
   *
   * 接口路径：POST /auth/email-code/login
   *
   * @param params - 登录参数，包含 email 与 code
   * @param errorHandler - 可选的错误处理函数
   */
  emailCodeLogin: (
    params: EmailCodeLoginParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<AuthResponseData>> =>
    clientRequest.post<AuthResponseData>('/auth/email-code/login', {
      params,
      skipAuthRefresh: true,
      errorHandler,
      timeout: 30000,
      retries: 0,
    }),

  /**
   * GitHub OAuth 登录
   *
   * 接口路径：POST /auth/github
   * 功能描述：使用 GitHub 授权码完成登录
   *
   * @param params - GitHub 登录参数，包含 code
   * @param errorHandler - 可选的错误处理函数
   * @returns 认证响应数据，包含 accessToken, refreshToken 和用户信息
   *
   * @example
   * ```typescript
   * // 获取 GitHub 授权码后
   * const { data, error } = await authApi.githubLogin({
   *   code: 'github_auth_code_from_callback'
   * });
   *
   * if (error) {
   *   console.error('GitHub 登录失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('GitHub 登录成功:', data.data.user);
   * }
   * ```
   */
  githubLogin: (
    params: GithubLoginParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<AuthResponseData>> =>
    clientRequest.post<AuthResponseData>('/auth/github', {
      params,
      errorHandler,
      timeout: 60000,
    }),

  /**
   * 刷新 Token
   *
   * 接口路径：POST /auth/refresh
   * 功能描述：使用刷新令牌获取新的访问令牌
   *
   * @param params - 刷新 Token 参数，包含 refreshToken
   * @param errorHandler - 可选的错误处理函数
   * @returns 新的 Token 数据，包含 accessToken 和 refreshToken
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.refreshToken({
   *   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   * });
   *
   * if (error) {
   *   console.error('刷新失败:', error);
   *   // 需要重新登录
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('Token 刷新成功');
   *   // 新 token 已自动保存到 cookie
   * }
   * ```
   *
   * @note 此方法通常由 request 模块内部自动调用，当检测到 401 错误时会自动刷新 token
   */
  refreshToken: (
    params: RefreshTokenParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<TokenRefreshResponseData>> =>
    clientRequest.post<TokenRefreshResponseData>('/auth/refresh', {
      params,
      errorHandler,
    }),

  /**
   * 验证 JWT Token
   *
   * 接口路径：GET /auth/verify
   * 功能描述：验证当前用户的 JWT Token 是否有效
   *
   * @param errorHandler - 可选的错误处理函数
   * @returns Token 验证结果，包含 valid 状态和 payload 信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.verifyToken();
   *
   * if (error) {
   *   console.error('验证失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('Token 有效:', data.data.valid);
   *   console.log('用户信息:', data.data.payload);
   * }
   * ```
   */
  verifyToken: (errorHandler?: ErrorHandler): Promise<RequestResult<VerifyTokenResponseData>> =>
    clientRequest.get<VerifyTokenResponseData>('/auth/verify', {
      errorHandler,
    }),

  /**
   * 退出登录
   *
   * 接口路径：POST /auth/logout
   * 功能描述：用户退出登录，服务端会清除相关会话
   *
   * @param params - 登出参数，可选，包含 userId
   * @param errorHandler - 可选的错误处理函数
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.logout({ userId: 'xxx' });
   *
   * if (error) {
   *   console.error('登出失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('登出成功');
   *   // 本地 token 会自动清除
   *   // 页面会自动跳转到登录页
   * }
   * ```
   */
  logout: (
    params?: LogoutParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<SuccessResponseData>> =>
    clientRequest.post<SuccessResponseData>('/auth/logout', {
      params: params || {},
      errorHandler,
    }),

  /**
   * 获取用户信息
   *
   * 接口路径：GET /auth/profile/:userId
   * 功能描述：获取指定用户的详细信息
   *
   * @param userId - 用户ID
   * @param errorHandler - 可选的错误处理函数
   * @returns 用户详细信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.getProfile('user_xxx');
   *
   * if (error) {
   *   console.error('获取用户信息失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('用户信息:', data.data);
   *   console.log('用户名:', data.data.name);
   *   console.log('邮箱:', data.data.email);
   * }
   * ```
   */
  getProfile: (
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<ProfileResponseData>> =>
    clientRequest.get<ProfileResponseData>(`/auth/profile/${userId}`, {
      errorHandler,
    }),

  /**
   * 更新用户信息
   *
   * 接口路径：PATCH /auth/profile/:userId
   * 功能描述：更新指定用户的资料信息
   *
   * @param userId - 用户ID
   * @param params - 更新参数，可包含 name, email, avatarUrl
   * @param errorHandler - 可选的错误处理函数
   * @returns 更新后的用户信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.updateProfile('user_xxx', {
   *   name: '新用户名',
   *   avatarUrl: 'https://example.com/avatar.jpg'
   * });
   *
   * if (error) {
   *   console.error('更新失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('更新成功:', data.data);
   * }
   * ```
   */
  updateProfile: (
    userId: string,
    params: UpdateProfileParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<ProfileResponseData>> =>
    clientRequest.patch<ProfileResponseData>(`/auth/profile/${userId}`, {
      params,
      errorHandler,
    }),

  /**
   * 修改密码
   *
   * 接口路径：PATCH /auth/profile/:userId/password
   * 功能描述：修改指定用户的登录密码
   *
   * @param userId - 用户ID
   * @param params - 密码修改参数，包含 oldPassword 和 newPassword
   * @param errorHandler - 可选的错误处理函数
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.changePassword('user_xxx', {
   *   oldPassword: 'oldpass123',
   *   newPassword: 'newpass456'
   * });
   *
   * if (error) {
   *   console.error('修改密码失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('密码修改成功');
   *   // 建议使用新密码重新登录
   * }
   * ```
   */
  changePassword: (
    userId: string,
    params: ChangePasswordParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<SuccessResponseData>> =>
    clientRequest.patch<SuccessResponseData>(`/auth/profile/${userId}/password`, {
      params,
      errorHandler,
    }),

  /**
   * 获取当前登录用户信息
   *
   * 接口路径：GET /auth/verify + GET /auth/profile/:userId
   * 功能描述：验证当前 token 并获取用户详细信息
   *
   * @param errorHandler - 可选的错误处理函数
   * @returns 当前用户详细信息
   *
   * @example
   * ```typescript
   * const { data, error } = await authApi.getCurrentUser();
   *
   * if (error) {
   *   console.error('获取当前用户信息失败:', error);
   *   return;
   * }
   *
   * if (data?.code === 200) {
   *   console.log('当前用户信息:', data.data);
   * }
   * ```
   */
  getCurrentUser: async (
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<ProfileResponseData>> => {
    // 首先验证 token 获取 userId
    const verifyResult = await clientRequest.get<VerifyTokenResponseData>('/auth/verify', {
      errorHandler,
    });

    if (verifyResult.error || !verifyResult.data?.data?.valid) {
      return {
        data: null,
        error: verifyResult.error || 'Token 验证失败',
        status: verifyResult.status,
      };
    }

    const userId = verifyResult.data.data.payload?.userId;
    if (!userId) {
      return {
        data: null,
        error: '无法获取用户ID',
        status: 400,
      };
    }

    // 然后获取用户详细信息
    return clientRequest.get<ProfileResponseData>(`/auth/profile/${userId}`, {
      errorHandler,
    });
  },
};

/**
 * 默认导出认证 API 对象
 */
export default authApi;

/**
 * 导出所有类型定义
 */
export * from './types';

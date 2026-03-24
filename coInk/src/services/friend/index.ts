import type {
  Friend,
  FriendRequestsResult,
  RespondFriendRequestParams,
  SendFriendRequestParams,
} from './types';

import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

/**
 * 好友管理服务类
 */
export class FriendService {
  private baseUrl = '/friends';

  /**
   * 获取好友列表
   */
  async getFriendList(
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<Friend[]>> {
    return clientRequest.get<Friend[]>(`${this.baseUrl}`, {
      params: { userId },
      errorHandler,
    });
  }

  async getFriendRequests(
    userId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<FriendRequestsResult>> {
    return clientRequest.get<FriendRequestsResult>(`${this.baseUrl}/requests`, {
      params: { userId },
      errorHandler,
    });
  }

  async sendFriendRequest(
    params: SendFriendRequestParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<{ requestId: string; status: string }>> {
    return clientRequest.post<{ requestId: string; status: string }>(`${this.baseUrl}/requests`, {
      params,
      errorHandler,
    });
  }

  async respondFriendRequest(
    requestId: string,
    params: RespondFriendRequestParams,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<{ requestId: string; status: string }>> {
    return clientRequest.patch<{ requestId: string; status: string }>(
      `${this.baseUrl}/requests/${requestId}/respond`,
      {
        params,
        errorHandler,
      },
    );
  }
}

// 创建单例实例
export const friendService = new FriendService();

// 导出默认实例
export default friendService;

// 导出所有类型
export * from './types';

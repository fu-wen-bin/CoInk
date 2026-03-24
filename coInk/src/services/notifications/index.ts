import request, { ErrorHandler } from '../request';

/**
 * 通知响应DTO
 */
export interface NotificationResponseDto {
  notificationId: string;
  requestId: string;
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

/**
 * 通知列表响应DTO
 */
export interface NotificationListResponseDto {
  notifications: NotificationResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 未读通知数量响应DTO
 */
export interface UnreadCountResponseDto {
  count: number;
}

/**
 * 标记已读响应DTO
 */
export interface MarkAsReadResponseDto {
  notificationId: string;
  requestId: string;
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

/**
 * 删除通知响应DTO
 */
export interface DeleteNotificationResponseDto {
  success?: boolean;
}

/**
 * 重试失败通知响应DTO
 */
export interface RetryFailedResponseDto {
  success: boolean;
  message: string;
}

/**
 * 清理结果响应DTO
 */
export interface CleanupResultResponseDto {
  count: number;
}

/**
 * 查询通知列表的参数
 */
export interface GetNotificationsQuery {
  page?: number;
  limit?: number;
}

export const NotificationApi = {
  /**
   * 获取未读通知数量
   */
  getUnreadCount: (errorHandler?: ErrorHandler) => {
    return request.get<UnreadCountResponseDto>('/notifications/unread', {
      errorHandler,
    });
  },

  /**
   * 获取通知列表
   * @param query 分页参数
   */
  getNotifications: (query?: GetNotificationsQuery, errorHandler?: ErrorHandler) => {
    return request.get<NotificationListResponseDto>('/notifications', {
      params: query,
      errorHandler,
    });
  },

  /**
   * 标记指定通知为已读
   * @param notificationId 通知ID
   */
  markAsRead: (notificationId: string, errorHandler?: ErrorHandler) => {
    return request.patch<MarkAsReadResponseDto>(`/notifications/${notificationId}/read`, {
      errorHandler,
    });
  },

  /**
   * 标记所有通知为已读
   */
  markAllAsRead: (errorHandler?: ErrorHandler) => {
    return request.patch<MarkAsReadResponseDto>('/notifications/read-all', {
      errorHandler,
    });
  },

  /**
   * 删除指定通知
   * @param notificationId 通知ID
   */
  deleteNotification: (notificationId: string, errorHandler?: ErrorHandler) => {
    return request.delete<DeleteNotificationResponseDto>(`/notifications/${notificationId}`, {
      errorHandler,
    });
  },

  /**
   * 重试推送失败的通知
   */
  retryFailedNotifications: (errorHandler?: ErrorHandler) => {
    return request.post<RetryFailedResponseDto>('/notifications/failed/retry', {
      errorHandler,
    });
  },

  /**
   * 清理过期通知（管理员功能）
   */
  cleanupExpiredNotifications: (errorHandler?: ErrorHandler) => {
    return request.delete<CleanupResultResponseDto>('/notifications/expired', {
      errorHandler,
    });
  },
};

export default NotificationApi;

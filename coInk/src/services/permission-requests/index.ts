import { clientRequest } from '@/services/request';
import type { ErrorHandler, RequestResult } from '@/services/request';

export type PermissionLevel = 'view' | 'comment' | 'edit' | 'manage';

export interface PermissionRequestItem {
  requestId: string;
  documentId: string;
  applicantId: string;
  targetPermission: PermissionLevel;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  message: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const permissionRequestsApi = {
  create: (
    params: {
      documentId: string;
      applicantId: string;
      targetPermission: PermissionLevel;
      message?: string;
    },
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<PermissionRequestItem>> =>
    clientRequest.post<PermissionRequestItem>('/permission-requests', {
      params,
      errorHandler,
    }),

  review: (
    requestId: string,
    params: {
      reviewerId: string;
      action: 'approve' | 'reject';
    },
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<PermissionRequestItem>> =>
    clientRequest.patch<PermissionRequestItem>(`/permission-requests/${requestId}/review`, {
      params,
      errorHandler,
    }),

  mine: (
    applicantId: string,
    errorHandler?: ErrorHandler,
  ): Promise<RequestResult<PermissionRequestItem[]>> =>
    clientRequest.get<PermissionRequestItem[]>('/permission-requests/mine', {
      params: { applicantId },
      errorHandler,
    }),
};

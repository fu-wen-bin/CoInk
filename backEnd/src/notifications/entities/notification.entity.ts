export class Notification {
  notificationId: string;
  requestId: string;
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
}

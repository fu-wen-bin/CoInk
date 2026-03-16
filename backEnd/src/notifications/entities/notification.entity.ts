export class Notification {
  notificationId: bigint;
  requestId: bigint;
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
}

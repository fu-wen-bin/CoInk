export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  FRIEND_REQUEST_CREATED: '收到好友申请',
  FRIEND_REQUEST_REVIEWED: '好友申请已处理',
  PERMISSION_REQUEST_CREATED: '收到权限申请',
  PERMISSION_REQUEST_REVIEWED: '权限申请已处理',
  DOCUMENT_PERMISSION_CHANGED: '文档权限已变更',
  PERMISSION_REQUEST_FAILED: '权限申请推送失败',
};

export const getNotificationTypeLabel = (type: string): string => {
  return NOTIFICATION_TYPE_LABELS[type] ?? '系统通知';
};

const getStringPayloadValue = (payload: Record<string, unknown>, key: string): string | null => {
  const value = payload[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const getNotificationDocumentTitle = (payload: Record<string, unknown>): string | null => {
  const documentObject = payload.document;
  let nestedTitle: string | null = null;
  if (documentObject && typeof documentObject === 'object') {
    const nestedPayload = documentObject as Record<string, unknown>;
    nestedTitle =
      getStringPayloadValue(nestedPayload, 'title') ?? getStringPayloadValue(nestedPayload, 'name');
  }

  return (
    getStringPayloadValue(payload, 'documentTitle') ??
    getStringPayloadValue(payload, 'documentName') ??
    getStringPayloadValue(payload, 'docTitle') ??
    getStringPayloadValue(payload, 'title') ??
    getStringPayloadValue(payload, 'name') ??
    nestedTitle
  );
};

export const getNotificationDocumentId = (payload: Record<string, unknown>): string | null => {
  return getStringPayloadValue(payload, 'documentId');
};

import { toast as sonnerToast, type ToastT } from 'sonner';

/**
 * Toast 工具函数
 * 封装 Sonner toast，提供统一的样式配置
 */

interface ToastOptions {
  duration?: number;
  id?: string | number;
  onDismiss?: (toast: ToastT) => void;
  onAutoClose?: (toast: ToastT) => void;
}

/**
 * 成功提示 - 绿色主题
 */
export function toastSuccess(message: string, options?: ToastOptions) {
  return sonnerToast.success(message, {
    ...options,
    style: {
      background: '#dcfce7',
      border: '1px solid #86efac',
      color: '#166534',
      width: 'auto',
      minWidth: 'unset',
      maxWidth: 'none',
      display: 'flex',
      alignItems: 'center',
    },
    icon: undefined,
  });
}

/**
 * 错误提示 - 红色主题
 */
export function toastError(message: string, options?: ToastOptions) {
  return sonnerToast.error(message, {
    ...options,
    style: {
      background: '#fee2e2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
      width: 'auto',
      minWidth: 'unset',
      maxWidth: 'none',
      display: 'flex',
      alignItems: 'center',
    },
    icon: undefined,
  });
}

/**
 * 警告提示 - 橙黄色主题
 */
export function toastWarning(message: string, options?: ToastOptions) {
  return sonnerToast.warning(message, {
    ...options,
    style: {
      background: '#fef3c7',
      border: '1px solid #fcd34d',
      color: '#92400e',
      width: 'auto',
      minWidth: 'unset',
      maxWidth: 'none',
      display: 'flex',
      alignItems: 'center',
    },
    icon: undefined,
  });
}

/**
 * 普通消息提示 - 灰黑色主题（默认样式）
 */
export function toastInfo(message: string, options?: ToastOptions) {
  return sonnerToast(message, {
    ...options,
    style: {
      background: '#f3f4f6',
      border: '1px solid #d1d5db',
      color: '#374151',
      width: 'auto',
      minWidth: 'unset',
      maxWidth: 'none',
      display: 'flex',
      alignItems: 'center',
    },
  });
}

/**
 * 加载中提示
 */
export function toastLoading(message: string, options?: ToastOptions) {
  return sonnerToast.loading(message, {
    ...options,
    style: {
      background: '#f3f4f6',
      border: '1px solid #d1d5db',
      color: '#374151',
      width: 'auto',
      minWidth: 'unset',
      maxWidth: 'none',
      display: 'flex',
      alignItems: 'center',
    },
  });
}

/**
 * 自定义样式 toast（直接暴露 sonner 的 toast 用于更复杂的场景）
 */
export const toast = sonnerToast;

export default {
  success: toastSuccess,
  error: toastError,
  warning: toastWarning,
  info: toastInfo,
  loading: toastLoading,
  custom: toast,
};

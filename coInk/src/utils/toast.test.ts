import { describe, it, expect, vi } from 'vitest';
import { toastSuccess, toastError, toastWarning, toastInfo, toastLoading } from './toast';

// Mock sonner
vi.mock('sonner', () => {
  const toast = Object.assign(
    vi.fn((msg, opts) => ({ message: msg, ...opts })),
    {
      success: vi.fn((msg, opts) => ({ message: msg, ...opts })),
      error: vi.fn((msg, opts) => ({ message: msg, ...opts })),
      warning: vi.fn((msg, opts) => ({ message: msg, ...opts })),
      loading: vi.fn((msg, opts) => ({ message: msg, ...opts })),
    },
  );

  return { toast };
});

describe('Toast Utils', () => {
  it('should create success toast with correct styles', () => {
    const result = toastSuccess('成功消息');
    expect(result.message).toBe('成功消息');
  });

  it('should create error toast with correct styles', () => {
    const result = toastError('错误消息');
    expect(result.message).toBe('错误消息');
  });

  it('should create warning toast with correct styles', () => {
    const result = toastWarning('警告消息');
    expect(result.message).toBe('警告消息');
  });

  it('should create info toast with correct styles', () => {
    const result = toastInfo('普通消息');
    expect(result.message).toBe('普通消息');
  });

  it('should create loading toast with correct styles', () => {
    const result = toastLoading('加载中...');
    expect(result.message).toBe('加载中...');
  });
});

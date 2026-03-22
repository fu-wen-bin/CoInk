/**
 * 从 localStorage 读取登录后缓存的用户资料，得到当前用户 ID。
 * 与 fileStore / 文档页等处使用的 `cached_user_profile` 约定一致。
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('cached_user_profile');
    if (!cached) return null;
    const parsed = JSON.parse(cached) as { userId?: string };
    const id = parsed.userId?.trim();
    return id || null;
  } catch {
    return null;
  }
}

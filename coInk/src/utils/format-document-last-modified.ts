import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 文档「最近修改」展示文案（与 Header / 菜单一致）
 *
 * 规则（相对当前客户端时间）：
 * - 2 分钟内：刚刚
 * - 24 小时内（且 ≥2 分钟）：N 分钟前 / N 小时前
 * - 满 24 小时及以上：M月d日 HH:mm（本地时区）
 *
 * 时间来源：后端 `documents.updatedAt`（协作保存时由 Nest/Prisma 更新），前端仅做与当前时间的差值比较。
 */
export function formatDocumentLastModified(input: string | Date | undefined | null): string {
  if (input === undefined || input === null || input === '') return '';

  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0) {
    return format(date, 'M月d日 HH:mm', { locale: zhCN });
  }

  const twoMinutesMs = 2 * 60 * 1000;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  if (diffMs < twoMinutesMs) {
    return '刚刚';
  }

  if (diffMs < twentyFourHoursMs) {
    const minutesTotal = Math.floor(diffMs / (60 * 1000));
    if (minutesTotal < 60) {
      return `${minutesTotal}分钟前`;
    }
    const hours = Math.floor(minutesTotal / 60);
    return `${hours}小时前`;
  }

  return format(date, 'M月d日 HH:mm', { locale: zhCN });
}

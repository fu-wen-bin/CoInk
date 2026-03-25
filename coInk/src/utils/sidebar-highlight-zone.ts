import type { FileItem } from '@/types/file-system';

export type SidebarHighlightZone = 'library' | 'shared' | 'starred' | null;

export function findFileInLibraryTree(items: FileItem[], id: string): boolean {
  const idStr = String(id);
  for (const item of items) {
    if (String(item.id) === idStr) return true;
    if (item.children?.length && findFileInLibraryTree(item.children, id)) return true;
  }
  return false;
}

/**
 * 当前打开文档在侧栏的「主」展示分区：我的文档库（自有 + 有效权限为 manage 的协作文档）> 共享（非 manage）> 收藏。
 * 仅非 manage 权限的协作文档在「共享的文档」高亮；manage 协作文档在文档库树中高亮。
 */
export function getSidebarHighlightZone(
  roomId: string | null | undefined,
  libraryFiles: FileItem[],
  sharedIds: readonly string[],
  starredIds: readonly string[],
): SidebarHighlightZone {
  if (!roomId) return null;
  const id = String(roomId);
  if (findFileInLibraryTree(libraryFiles, id)) return 'library';
  if (sharedIds.some((x) => String(x) === id)) return 'shared';
  if (starredIds.some((x) => String(x) === id)) return 'starred';
  return null;
}

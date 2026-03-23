import type { FileItem } from '@/types/file-system';
import type { FileDocumentGroup } from '@/stores/fileStore';

/** 递归统计树中节点总数（含子文件夹内文档与文件夹） */
export function countAllNodesInTree(items: FileItem[]): number {
  let n = 0;
  const walk = (list: FileItem[]) => {
    for (const item of list) {
      n += 1;
      if (item.children?.length) walk(item.children);
    }
  };
  walk(items);
  return n;
}

export function countAllNodesInGroups(groups: FileDocumentGroup[]): number {
  return groups.reduce((acc, g) => acc + countAllNodesInTree(g.files), 0);
}

/** 文档库中全部可选项 id（含子文件夹内节点），与 selectAll 一致 */
export function collectAllFileItemIds(groups: FileDocumentGroup[]): string[] {
  const ids: string[] = [];
  const walk = (items: FileItem[]) => {
    for (const item of items) {
      ids.push(String(item.id));
      if (item.children?.length) walk(item.children);
    }
  };
  for (const g of groups) walk(g.files);
  return ids;
}

/** 在文档树中解析批量选中的 id，仅返回「文件」类型 id（用于批量收藏等） */
export function collectSelectedFileIds(
  groups: FileDocumentGroup[],
  selectedIds: string[],
): string[] {
  const want = new Set(selectedIds.map(String));
  const out: string[] = [];
  const walk = (items: FileItem[]) => {
    for (const item of items) {
      if (item.type === 'file' && want.has(String(item.id))) {
        out.push(String(item.id));
      }
      if (item.children?.length) walk(item.children);
    }
  };
  for (const g of groups) walk(g.files);
  return out;
}

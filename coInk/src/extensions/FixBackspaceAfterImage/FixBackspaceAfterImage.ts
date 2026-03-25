import { Extension } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * 修复图片下方空行删除问题：
 * 当在图片下方的空行按 Backspace 时，应该只删除空行并选中上方的图片，
 * 而不是删除上一行的图片。
 */
export const FixBackspaceAfterImage = Extension.create({
  name: 'fixBackspaceAfterImage',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;

        // 只有在光标位置为空选择时才处理
        if (!selection.empty) return false;

        const { $from } = selection;
        const currentNode = $from.parent;

        // 检查当前节点是否是空段落
        if (currentNode.type.name !== 'paragraph') return false;
        if (currentNode.content.size > 0) return false;

        // 检查是否在段落开始位置（确保是空行的开始）
        if ($from.parentOffset !== 0) return false;

        // 获取当前段落在文档中的开始位置
        const currentBlockStart = $from.before($from.depth);

        // 如果已经在文档开头，不处理
        if (currentBlockStart <= 1) return false;

        // 使用 $from.nodeBefore 获取紧邻的前一个节点
        const prevNode = $from.nodeBefore;

        if (!prevNode) return false;

        // 检查前一个节点是否是图片类型
        const isImageNode =
          prevNode.type.name === 'image' ||
          prevNode.type.name === 'imageBlock' ||
          prevNode.type.name === 'imageUpload';

        if (!isImageNode) return false;

        // 计算前一个节点的开始位置
        // 当前块的开始位置 - 前一个节点的大小 = 前一个节点的开始位置
        const prevNodeStart = currentBlockStart - prevNode.nodeSize;

        // 删除当前空段落
        const tr = state.tr.delete(currentBlockStart, currentBlockStart + currentNode.nodeSize);

        // 选中图片节点
        tr.setSelection(NodeSelection.create(tr.doc, prevNodeStart));

        editor.view.dispatch(tr);
        return true;
      },
    };
  },
});

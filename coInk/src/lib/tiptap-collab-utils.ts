import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, type Selection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import type { JSONContent, Editor } from '@tiptap/react';
import { isTextSelection, isNodeSelection, posToDOMRect } from '@tiptap/react';

/**
 * 图片块选中时，用实际图片容器作为浮动层参照，使工具栏水平居中对齐图片（而非整行宽）。
 */
export const getImageSelectionReferenceElement = (editor: Editor | null): HTMLElement | null => {
  if (!editor) return null;
  const { selection } = editor.state;
  if (!isNodeSelection(selection) || selection.node.type.name !== 'image') return null;
  const nodeDom = editor.view.nodeDOM(selection.from) as HTMLElement | null;
  if (!nodeDom) return null;
  return nodeDom.querySelector('.tiptap-image-container') as HTMLElement | null;
};

/** 拖拽菜单 / 转换 上方的块类型标题（中文；标题为 H1、H2、H3…） */
const BLOCK_TYPE_LABELS: Record<string, string> = {
  paragraph: '正文',
  blockquote: '引用',
  codeBlock: '代码块',
  table: '表格',
  tocNode: '目录',
  bulletList: '无序列表',
  orderedList: '有序列表',
  taskList: '任务列表',
  listItem: '无序列表',
  taskItem: '任务列表',
  image: '图片',
  imageUpload: '图片',
  horizontalRule: '分割线',
  details: '折叠列表',
};

function humanizeNodeTypeName(name: string): string {
  const spaced = name.replace(/([A-Z])/g, ' $1').trim();
  if (!spaced) return name;
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** 当前块的展示名（标题为 H1、H2、H3…，其余为中文） */
function labelForBlockNode(node: PMNode, editor: Editor | null): string {
  const name = node.type.name;

  if (name === 'heading') {
    const level = node.attrs.level as number;
    return `H${level}`;
  }

  if (name === 'paragraph' && editor) {
    if (editor.isActive('heading')) {
      const level = editor.getAttributes('heading').level as number;
      return `H${level}`;
    }
    if (editor.isActive('bulletList')) return '无序列表';
    if (editor.isActive('orderedList')) return '有序列表';
    if (editor.isActive('taskList')) return '任务列表';
  }

  if (name === 'listItem' && editor) {
    if (editor.isActive('orderedList')) return '有序列表';
    if (editor.isActive('taskList')) return '任务列表';
    return '无序列表';
  }

  if (name === 'taskItem') {
    return '任务列表';
  }

  return BLOCK_TYPE_LABELS[name] ?? humanizeNodeTypeName(name);
}

export type OverflowPosition = 'none' | 'top' | 'bottom' | 'both';

/**
 * 当前块的展示名（中文；标题为 H1、H2、H3…）。
 * @param dragHandleNode 来自拖拽柄时，与当前块一致（避免选区尚未更新）。
 */
export const getNodeDisplayName = (editor: Editor | null, dragHandleNode?: PMNode | null): string => {
  if (!editor) return '块';

  if (dragHandleNode) {
    return labelForBlockNode(dragHandleNode, editor);
  }

  const { selection } = editor.state;

  if (selection instanceof NodeSelection) {
    return labelForBlockNode(selection.node, editor);
  }

  if (selection instanceof CellSelection) {
    return '表格';
  }

  if (editor.isActive('heading')) {
    const level = editor.getAttributes('heading').level as number;
    return `H${level}`;
  }
  if (editor.isActive('bulletList')) return '无序列表';
  if (editor.isActive('orderedList')) return '有序列表';
  if (editor.isActive('taskList')) return '任务列表';
  if (editor.isActive('blockquote')) return '引用';
  if (editor.isActive('codeBlock')) return '代码块';

  const parent = selection.$anchor.parent;
  return labelForBlockNode(parent, editor);
};

/**
 * Removes empty paragraph nodes from content
 */
export const removeEmptyParagraphs = (content: JSONContent) => ({
  ...content,
  content: content.content?.filter(
    (node) =>
      node.type !== 'paragraph' ||
      node.content?.some((child) => child.text?.trim() || child.type !== 'text'),
  ),
});

/**
 * Determines how a target element overflows relative to a container element
 */
export function getElementOverflowPosition(
  targetElement: Element,
  containerElement: HTMLElement,
): OverflowPosition {
  const targetBounds = targetElement.getBoundingClientRect();
  const containerBounds = containerElement.getBoundingClientRect();

  const isOverflowingTop = targetBounds.top < containerBounds.top;
  const isOverflowingBottom = targetBounds.bottom > containerBounds.bottom;

  if (isOverflowingTop && isOverflowingBottom) return 'both';
  if (isOverflowingTop) return 'top';
  if (isOverflowingBottom) return 'bottom';
  return 'none';
}

/**
 * Checks if the current selection is valid for a given editor
 */
export const isSelectionValid = (
  editor: Editor | null,
  selection?: Selection,
  excludedNodeTypes: string[] = ['imageUpload', 'horizontalRule'],
): boolean => {
  if (!editor) return false;
  if (!selection) selection = editor.state.selection;

  const { state } = editor;
  const { doc } = state;
  const { empty, from, to } = selection;

  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(selection);
  const isCodeBlock =
    selection.$from.parent.type.spec.code ||
    (isNodeSelection(selection) && selection.node.type.spec.code);
  const isExcludedNode =
    isNodeSelection(selection) && excludedNodeTypes.includes(selection.node.type.name);
  const isTableCell = selection instanceof CellSelection;

  return !empty && !isEmptyTextBlock && !isCodeBlock && !isExcludedNode && !isTableCell;
};

/**
 * Checks if the current text selection is valid for editing
 * - Not empty
 * - Not a code block
 * - Not a node selection
 */
export const isTextSelectionValid = (editor: Editor | null): boolean => {
  if (!editor) return false;
  const { state } = editor;
  const { selection } = state;
  const isValid =
    isTextSelection(selection) &&
    !selection.empty &&
    !selection.$from.parent.type.spec.code &&
    !isNodeSelection(selection);

  return isValid;
};

/**
 * Gets the bounding rect of the current selection in the editor.
 */
export const getSelectionBoundingRect = (editor: Editor): DOMRect | null => {
  const { state } = editor.view;
  const { selection } = state;
  const { ranges } = selection;

  const from = Math.min(...ranges.map((range) => range.$from.pos));
  const to = Math.max(...ranges.map((range) => range.$to.pos));

  if (isNodeSelection(selection)) {
    const node = editor.view.nodeDOM(from) as HTMLElement;
    if (node) {
      if (selection.node.type.name === 'image') {
        const imageBox = node.querySelector('.tiptap-image-container') as HTMLElement | null;
        if (imageBox) {
          return imageBox.getBoundingClientRect();
        }
      }
      return node.getBoundingClientRect();
    }
  }

  return posToDOMRect(editor.view, from, to);
};

/**
 * Generates a deterministic avatar URL from a user name
 */
export const getAvatar = (name: string) => {
  if (!name) {
    return '/avatars/memoji_01.png';
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const randomFraction = (Math.abs(hash) % 1000000) / 1000000;
  const id = 1 + Math.floor(randomFraction * 20);
  const idString = id.toString().padStart(2, '0');
  return `/avatars/memoji_${idString}.png`;
};

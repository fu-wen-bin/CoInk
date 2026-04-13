'use client';

import { HocuspocusProvider } from '@hocuspocus/provider';
import { isChangeOrigin } from '@tiptap/extension-collaboration';
import Mathematics, { migrateMathStrings } from '@tiptap/extension-mathematics';
import { Extension } from '@tiptap/core';

import {
  CharacterCount,
  CodeBlock,
  Color,
  Details,
  DetailsContent,
  DetailsSummary,
  Document,
  HardBreak,
  Paragraph,
  Text,
  // Image,
  Dropcursor,
  Emoji,
  Figcaption,
  Focus,
  FontFamily,
  FontSize,
  Heading,
  Highlight,
  HorizontalRule,
  ImageBlock,
  TableImage,
  Link,
  Placeholder,
  Selection,
  SlashCommand,
  StarterKit,
  Subscript,
  Superscript,
  Table,
  TableOfContents,
  TableCell,
  TableHeader,
  TableRow,
  TextAlign,
  TextStyle,
  TrailingNode,
  Typography,
  Underline,
  TaskList,
  TaskItem,
  Columns,
  Column,
  UniqueID,
  DraggableBlock,
  DragHandler,
  FileHandler,
  ClearMarksOnEnter,
  Mention,
  mentionSuggestion,
  MathLiveExtension,
  SearchAndReplace,
} from '.';
import { ImageUpload } from './ImageUpload';
import { TableOfContentsNode } from './TableOfContentsNode';

import { toastError } from '@/utils/toast';
import { SelectOnlyCode } from '@/extensions/CodeBlock';
import { Image as EditorImage } from '@/components/tiptap-node/image-node/image-node-extension';
import { NodeAlignment } from '@/components/tiptap-extension/node-alignment-extension';
import { NodeBackground } from '@/components/tiptap-extension/node-background-extension';
import { TocNode } from '@/components/tiptap-node/toc-node/extensions/toc-node-extension';
import uploadService from '@/services/upload';

function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '图片上传失败';
}

export interface ExtensionKitProps {
  provider: HocuspocusProvider | null;
}

// 在ExtensionKit数组中添加
export const ExtensionKit = ({ provider }: ExtensionKitProps) => [
  Document,
  HardBreak,
  Paragraph,
  Text,
  // Image,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Columns,
  Column,
  Selection,
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  HorizontalRule,
  UniqueID.configure({
    types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'table'],
    filterTransaction: (transaction) => !isChangeOrigin(transaction),
  }),
  StarterKit.configure({
    document: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    undoRedo: false,
    codeBlock: false,
    paragraph: false,
    hardBreak: false,
    text: false,
    link: false,
    underline: false,
    trailingNode: false,
  } as any),
  Details.configure({
    persist: true,
    HTMLAttributes: {
      class: 'details',
    },
  }),
  DetailsContent,
  DetailsSummary,
  CodeBlock,
  TextStyle,
  FontSize,
  FontFamily,
  Color,
  TrailingNode,
  Link.configure({
    openOnClick: false,
  }),
  Highlight.configure({ multicolor: true }),
  Underline,
  CharacterCount.configure({ limit: 50000 }),
  TableOfContents,
  TableOfContentsNode,
  ImageUpload.configure({
    clientId: provider?.document?.clientID,
  }),
  ImageBlock,
  TableImage,
  DraggableBlock,
  DragHandler,
  FileHandler.configure({
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    onDrop: (currentEditor, files, pos) => {
      files.forEach((file) => {
        void (async () => {
          try {
            const url = await uploadService.uploadImage(file);

            // 检查是否在表格中
            const resolvedPos = currentEditor.state.doc.resolve(pos);
            let isInTable = false;

            for (let i = resolvedPos.depth; i > 0; i--) {
              const node = resolvedPos.node(i);

              if (
                node.type.name === 'table' ||
                node.type.name === 'tableCell' ||
                node.type.name === 'tableHeader'
              ) {
                isInTable = true;
                break;
              }
            }

            if (isInTable) {
              currentEditor.chain().setTableImageAt({ pos, src: url }).focus().run();
            } else {
              currentEditor.chain().setImageBlockAt({ pos, src: url }).focus().run();
            }
          } catch (error) {
            toastError(uploadErrorMessage(error));
          }
        })();
      });
    },
    onPaste: (currentEditor, files) => {
      files.forEach(async (file) => {
        const pos = currentEditor.state.selection.anchor;

        try {
          // 检查是否在表格中
          const resolvedPos = currentEditor.state.doc.resolve(pos ?? 0);
          let isInTable = false;

          for (let i = resolvedPos.depth; i > 0; i--) {
            const node = resolvedPos.node(i);

            if (
              node.type.name === 'table' ||
              node.type.name === 'tableCell' ||
              node.type.name === 'tableHeader'
            ) {
              isInTable = true;
              break;
            }
          }

          // 先显示 base64 预览
          const base64Url = await readFileAsDataURL(file);

          if (isInTable) {
            // 在表格中使用TableImage
            currentEditor
              .chain()
              .deleteRange({ from: pos ?? 0, to: pos ?? 0 })
              .setTableImage({ src: base64Url })
              .focus()
              .run();
          } else {
            // 普通环境使用ImageBlock
            currentEditor
              .chain()
              .deleteRange({ from: pos ?? 0, to: pos ?? 0 })
              .setImageBlock({ src: base64Url })
              .focus()
              .run();
          }

          // 后台上传文件
          const serverUrl = await uploadService.uploadImage(file);

          // 查找并更新图片节点
          let targetPos: number | null = null;

          if (isInTable) {
            targetPos = findTableImageNodeByUrl(currentEditor.state, base64Url);

            if (targetPos !== null) {
              updateTableImageNode(currentEditor, targetPos, serverUrl);
            }
          } else {
            targetPos = findImageNodeByUrl(currentEditor.state, base64Url);

            if (targetPos !== null) {
              updateImageNode(currentEditor, targetPos, serverUrl);
            }
          }
        } catch (error) {
          toastError(uploadErrorMessage(error));
        }
      });

      // 辅助函数：将文件读取为 DataURL
      function readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result);
          };

          reader.onerror = () => {
            reject(new Error('文件读取失败'));
          };

          reader.readAsDataURL(file);
        });
      }

      // 辅助函数：查找图片节点
      function findImageNodeByUrl(state: any, url: string): number | null {
        let targetPos: number | null = null;

        state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'imageBlock' && node.attrs.src === url) {
            targetPos = pos;

            return false; // 停止遍历
          }
        });

        return targetPos;
      }

      // 辅助函数：查找表格图片节点
      function findTableImageNodeByUrl(state: any, url: string): number | null {
        let targetPos: number | null = null;

        state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'tableImage' && node.attrs.src === url) {
            targetPos = pos;

            return false; // 停止遍历
          }
        });

        return targetPos;
      }

      // 辅助函数：更新图片节点
      function updateImageNode(editor: any, pos: number, newSrc: string): void {
        editor
          .chain()
          .command(({ tr }: { tr: any }) => {
            tr.setNodeMarkup(pos, undefined, { src: newSrc });

            return true;
          })
          .focus()
          .run();
      }

      // 辅助函数：更新表格图片节点
      function updateTableImageNode(editor: any, pos: number, newSrc: string): void {
        editor
          .chain()
          .command(({ tr }: { tr: any }) => {
            tr.setNodeMarkup(pos, undefined, { src: newSrc });

            return true;
          })
          .focus()
          .run();
      }
    },
  }),

  Emoji.configure({
    enableEmoticons: true,
  }),
  TextAlign.extend({
    addKeyboardShortcuts() {
      return {
        Tab: () => {
          return this.editor.commands.insertContent('  ');
        },
        'Shift-Tab': () => {
          const { state } = this.editor;
          const { from } = state.selection;
          const $from = state.doc.resolve(from);
          const startOfLine = $from.start($from.depth);
          const textBeforeCursor = state.doc.textBetween(startOfLine, from);

          if (textBeforeCursor.endsWith('  ')) {
            const deleteFrom = Math.max(startOfLine, from - 2);

            return this.editor.commands.deleteRange({ from: deleteFrom, to: from });
          } else if (textBeforeCursor.endsWith(' ')) {
            return this.editor.commands.deleteRange({ from: from - 1, to: from });
          }

          return false;
        },
      };
    },
  }).configure({
    types: ['heading', 'paragraph'],
  }),
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: () => '',
  }),
  SlashCommand,
  Focus,
  Figcaption,
  Dropcursor.configure({
    width: 2,
    class: 'ProseMirror-dropcursor border-black',
  }),
  SelectOnlyCode,
  // MathLive 专业数学编辑器
  MathLiveExtension,
  // 数学公式迁移扩展 - 自动将 $...$ 转换为数学节点
  Extension.create({
    name: 'mathMigration',
    onCreate({ editor }) {
      // 延迟执行，确保文档加载完成
      setTimeout(() => {
        migrateMathStrings(editor);
      }, 100);
    },
    onUpdate({ editor }) {
      // 每次更新时也检查（使用防抖）
      clearTimeout((this as unknown as { migrateTimeout?: NodeJS.Timeout }).migrateTimeout);
      (this as unknown as { migrateTimeout?: NodeJS.Timeout }).migrateTimeout = setTimeout(() => {
        migrateMathStrings(editor);
      }, 500);
    },
  }),
  // Mathematics 扩展配置
  Mathematics.configure({
    katexOptions: {
      throwOnError: false,
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\C': '\\mathbb{C}',
      },
    },
  }),
  ClearMarksOnEnter,
  Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: mentionSuggestion,
  }),
  SearchAndReplace.configure({
    searchResultClass: 'search-result',
    currentSearchResultClass: 'current-search-result',
    disableRegex: true,
    caseSensitive: false,
  }),
];

// 静态 ExtensionKit 配置（用于服务端/静态 HTML 生成）
// 不包含需要 provider 的协作相关扩展
export const StaticExtensionKit = [
  Document,
  HardBreak,
  Paragraph,
  Text,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Columns,
  Column,
  Selection,
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  HorizontalRule,
  StarterKit.configure({
    document: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    undoRedo: false,
    codeBlock: false,
    paragraph: false,
    hardBreak: false,
    text: false,
    link: false,
    underline: false,
    trailingNode: false,
  } as any),
  Details.configure({
    persist: true,
    HTMLAttributes: {
      class: 'details',
    },
  }),
  DetailsContent,
  DetailsSummary,
  CodeBlock,
  TextStyle,
  FontSize,
  FontFamily,
  Color,
  TrailingNode,
  Link.configure({
    openOnClick: false,
  }),
  Highlight.configure({ multicolor: true }),
  Underline,
  CharacterCount.configure({ limit: 50000 }),
  TableOfContents,
  TableOfContentsNode,
  /** 与协作编辑器一致：正文中的目录块为 `tocNode` */
  TocNode.configure({ topOffset: 48 }),
  ImageBlock,
  /** 与 notion-like 编辑器一致，支持 JSON 中的 `image` 节点（generateHTML 等） */
  EditorImage,
  TableImage,
  DraggableBlock,
  DragHandler,
  Emoji.configure({
    enableEmoticons: true,
  }),
  TextAlign.extend({}).configure({
    types: ['heading', 'paragraph'],
  }),
  NodeBackground.configure({
    types: [
      'paragraph',
      'heading',
      'blockquote',
      'taskList',
      'bulletList',
      'orderedList',
      'tableCell',
      'tableHeader',
      'tableOfContentsNode',
      'tocNode',
    ],
  }),
  NodeAlignment,
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: () => '',
  }),
  SlashCommand,
  Focus,
  Figcaption,
  Dropcursor.configure({
    width: 2,
    class: 'ProseMirror-dropcursor border-black',
  }),
  SelectOnlyCode,
  MathLiveExtension,
  Mathematics.configure({
    katexOptions: {
      throwOnError: false,
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\C': '\\mathbb{C}',
      },
    },
  }),
  ClearMarksOnEnter,
  Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
  }),
  SearchAndReplace.configure({
    searchResultClass: 'search-result',
    currentSearchResultClass: 'current-search-result',
    disableRegex: true,
    caseSensitive: false,
  }),
];

export default ExtensionKit;

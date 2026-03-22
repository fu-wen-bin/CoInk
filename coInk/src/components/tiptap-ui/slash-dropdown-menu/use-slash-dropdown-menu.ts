'use client';

import { createElement, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Code as LucideCodeIcon, Quote as LucideQuoteIcon } from 'lucide-react';

import { HeadingOneIcon } from '@/components/tiptap-icons/heading-one-icon';
import { HeadingTwoIcon } from '@/components/tiptap-icons/heading-two-icon';
import { HeadingThreeIcon } from '@/components/tiptap-icons/heading-three-icon';
import { ImageIcon } from '@/components/tiptap-icons/image-icon';
import { ListIcon } from '@/components/tiptap-icons/list-icon';
import { ListOrderedIcon } from '@/components/tiptap-icons/list-ordered-icon';
import { ListTodoIcon } from '@/components/tiptap-icons/list-todo-icon';
import { AiSparklesIcon } from '@/components/tiptap-icons/ai-sparkles-icon';
import { DividerOutlinedIcon } from '@/components/tiptap-icons/divider-outlined-icon';
import { TypeIcon } from '@/components/tiptap-icons/type-icon';
import { AtSignIcon } from '@/components/tiptap-icons/at-sign-icon';
import { SmilePlusIcon } from '@/components/tiptap-icons/smile-plus-icon';
import { TableIcon } from '@/components/tiptap-icons/table-icon';
import { ListIndentedIcon } from '@/components/tiptap-icons/list-indented-icon';
import { isExtensionAvailable, isNodeInSchema } from '@/lib/tiptap-utils';
import { findSelectionPosition, hasContentAbove } from '@/lib/tiptap-advanced-utils';
import type { SuggestionItem } from '@/components/tiptap-ui-utils/suggestion-menu';
import { addEmojiTrigger } from '@/components/tiptap-ui/emoji-trigger-button';
import { addMentionTrigger } from '@/components/tiptap-ui/mention-trigger-button';

/** 与拖拽柄上代码块/引用图标一致（Lucide） */
function SlashMenuCodeBadge(props: { className?: string }) {
  return createElement(LucideCodeIcon, { className: props.className, strokeWidth: 2.5 });
}
function SlashMenuQuoteBadge(props: { className?: string }) {
  return createElement(LucideQuoteIcon, { className: props.className, strokeWidth: 2.5 });
}

export interface SlashMenuConfig {
  enabledItems?: SlashMenuItemType[];
  customItems?: SuggestionItem[];
  itemGroups?: {
    [key in SlashMenuItemType]?: string;
  };
  showGroups?: boolean;
}

const texts = {
  // AI
  continue_writing: {
    title: '继续写作',
    subtext: '从当前位置继续写作',
    keywords: ['continue', 'write', 'continue writing', 'ai'],
    badge: AiSparklesIcon,
    group: 'AI',
  },
  ai_ask_button: {
    title: '询问 AI',
    subtext: '让 AI 帮你生成内容',
    keywords: ['ai', 'ask', 'generate'],
    badge: AiSparklesIcon,
    group: 'AI',
  },

  // Style
  text: {
    title: '正文',
    subtext: '普通文本段落',
    keywords: ['p', 'paragraph', 'text'],
    badge: TypeIcon,
    group: '样式',
  },
  heading_1: {
    title: '一级标题',
    subtext: '最高级别标题',
    keywords: ['h', 'heading1', 'h1'],
    badge: HeadingOneIcon,
    group: '样式',
  },
  heading_2: {
    title: '二级标题',
    subtext: '主要章节标题',
    keywords: ['h2', 'heading2', 'subheading'],
    badge: HeadingTwoIcon,
    group: '样式',
  },
  heading_3: {
    title: '三级标题',
    subtext: '小节与分组标题',
    keywords: ['h3', 'heading3', 'subheading'],
    badge: HeadingThreeIcon,
    group: '样式',
  },
  bullet_list: {
    title: '无序列表',
    subtext: '使用圆点展示的列表',
    keywords: ['ul', 'li', 'list', 'bulletlist', 'bullet list'],
    badge: ListIcon,
    group: '样式',
  },
  ordered_list: {
    title: '有序列表',
    subtext: '使用数字排序的列表',
    keywords: ['ol', 'li', 'list', 'numberedlist', 'numbered list'],
    badge: ListOrderedIcon,
    group: '样式',
  },
  task_list: {
    title: '任务列表',
    subtext: '可勾选任务清单',
    keywords: ['tasklist', 'task list', 'todo', 'checklist'],
    badge: ListTodoIcon,
    group: '样式',
  },
  quote: {
    title: '引用',
    subtext: '引用块',
    keywords: ['quote', 'blockquote'],
    badge: SlashMenuQuoteBadge,
    group: '样式',
  },
  code_block: {
    title: '代码块',
    subtext: '带语法高亮的代码块',
    keywords: ['code', 'pre'],
    badge: SlashMenuCodeBadge,
    group: '样式',
  },

  // Insert
  mention: {
    title: '提及',
    subtext: '提及用户或内容项',
    keywords: ['mention', 'user', 'item', 'tag'],
    badge: AtSignIcon,
    group: '插入',
  },
  emoji: {
    title: '表情',
    subtext: '插入一个表情',
    keywords: ['emoji', 'emoticon', 'smiley'],
    badge: SmilePlusIcon,
    group: '插入',
  },
  table: {
    title: '表格',
    subtext: '插入一个表格',
    aliases: ['table', 'insertTable'],
    badge: TableIcon,
    group: '插入',
  },
  divider: {
    title: '分割线',
    subtext: '使用横线分隔内容',
    keywords: ['hr', 'horizontalRule', 'line', 'separator'],
    badge: DividerOutlinedIcon,
    group: '插入',
  },
  toc: {
    title: '目录',
    subtext: '插入文档目录',
    keywords: ['toc', 'tableofcontents', 'table of contents'],
    badge: ListIndentedIcon,
    group: '插入',
  },

  // Upload
  image: {
    title: '图片',
    subtext: '可调整大小并带说明的图片',
    keywords: ['image', 'imageUpload', 'upload', 'img', 'picture', 'media', 'url'],
    badge: ImageIcon,
    group: '上传',
  },
};

export type SlashMenuItemType = keyof typeof texts;

const getItemImplementations = () => {
  return {
    // AI
    continue_writing: {
      check: (editor: Editor) => {
        const { hasContent } = hasContentAbove(editor);
        const extensionsReady = isExtensionAvailable(editor, ['ai', 'aiAdvanced']);
        return extensionsReady && hasContent;
      },
      action: ({ editor }: { editor: Editor }) => {
        const editorChain = editor.chain().focus();

        const nodeSelectionPosition = findSelectionPosition({ editor });

        if (nodeSelectionPosition !== null) {
          editorChain.setNodeSelection(nodeSelectionPosition);
        }

        editorChain.run();

        editor.chain().focus().aiGenerationShow().run();

        requestAnimationFrame(() => {
          const { hasContent, content } = hasContentAbove(editor);

          const snippet = content.length > 500 ? `...${content.slice(-500)}` : content;

          const prompt = hasContent
            ? `上下文：${snippet}\n\n请从上文结束处继续写作，仅输出一句话，不要重复已有文本。`
            : '请开始写一个新段落，仅输出一句话。';

          editor
            .chain()
            .focus()
            .aiTextPrompt({
              stream: true,
              format: 'rich-text',
              text: prompt,
            })
            .run();
        });
      },
    },
    ai_ask_button: {
      check: (editor: Editor) => isExtensionAvailable(editor, ['ai', 'aiAdvanced']),
      action: ({ editor }: { editor: Editor }) => {
        const editorChain = editor.chain().focus();

        const nodeSelectionPosition = findSelectionPosition({ editor });

        if (nodeSelectionPosition !== null) {
          editorChain.setNodeSelection(nodeSelectionPosition);
        }

        editorChain.run();

        editor.chain().focus().aiGenerationShow().run();
      },
    },

    // Style
    text: {
      check: (editor: Editor) => isNodeInSchema('paragraph', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().setParagraph().run();
      },
    },
    heading_1: {
      check: (editor: Editor) => isNodeInSchema('heading', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
    },
    heading_2: {
      check: (editor: Editor) => isNodeInSchema('heading', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    },
    heading_3: {
      check: (editor: Editor) => isNodeInSchema('heading', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
    },
    bullet_list: {
      check: (editor: Editor) => isNodeInSchema('bulletList', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleBulletList().run();
      },
    },
    ordered_list: {
      check: (editor: Editor) => isNodeInSchema('orderedList', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    task_list: {
      check: (editor: Editor) => isNodeInSchema('taskList', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleTaskList().run();
      },
    },
    quote: {
      check: (editor: Editor) => isNodeInSchema('blockquote', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    code_block: {
      check: (editor: Editor) => isNodeInSchema('codeBlock', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleNode('codeBlock', 'paragraph').run();
      },
    },

    // Insert
    mention: {
      check: (editor: Editor) => isExtensionAvailable(editor, ['mention', 'mentionAdvanced']),
      action: ({ editor }: { editor: Editor }) => addMentionTrigger(editor),
    },
    emoji: {
      check: (editor: Editor) => isExtensionAvailable(editor, ['emoji', 'emojiPicker']),
      action: ({ editor }: { editor: Editor }) => addEmojiTrigger(editor),
    },
    divider: {
      check: (editor: Editor) => isNodeInSchema('horizontalRule', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().setHorizontalRule().run();
      },
    },
    toc: {
      check: (editor: Editor) => isNodeInSchema('tocNode', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().insertTocNode().run();
      },
    },
    table: {
      check: (editor: Editor) => isNodeInSchema('table', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor
          .chain()
          .focus()
          .insertTable({
            rows: 3,
            cols: 3,
            withHeaderRow: false,
          })
          .run();
      },
    },

    // Upload
    image: {
      check: (editor: Editor) => isNodeInSchema('image', editor),
      action: ({ editor }: { editor: Editor }) => {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'imageUpload',
          })
          .run();
      },
    },
  };
};

function organizeItemsByGroups(items: SuggestionItem[], showGroups: boolean): SuggestionItem[] {
  if (!showGroups) {
    return items.map((item) => ({ ...item, group: '' }));
  }

  const groups: { [groupLabel: string]: SuggestionItem[] } = {};

  // Group items
  items.forEach((item) => {
    const groupLabel = item.group || '';
    if (!groups[groupLabel]) {
      groups[groupLabel] = [];
    }
    groups[groupLabel].push(item);
  });

  // Flatten groups in order (this maintains the visual order for keyboard navigation)
  const organizedItems: SuggestionItem[] = [];
  Object.entries(groups).forEach(([, groupItems]) => {
    organizedItems.push(...groupItems);
  });

  return organizedItems;
}

/**
 * Custom hook for slash dropdown menu functionality
 */
export function useSlashDropdownMenu(config?: SlashMenuConfig) {
  const getSlashMenuItems = useCallback(
    (editor: Editor) => {
      const items: SuggestionItem[] = [];

      const enabledItems = config?.enabledItems || (Object.keys(texts) as SlashMenuItemType[]);
      const showGroups = config?.showGroups !== false;

      const itemImplementations = getItemImplementations();

      enabledItems.forEach((itemType) => {
        const itemImpl = itemImplementations[itemType];
        const itemText = texts[itemType];

        if (itemImpl && itemText && itemImpl.check(editor)) {
          const item: SuggestionItem = {
            onSelect: ({ editor }) => itemImpl.action({ editor }),
            ...itemText,
          };

          if (config?.itemGroups?.[itemType]) {
            item.group = config.itemGroups[itemType];
          } else if (!showGroups) {
            item.group = '';
          }

          items.push(item);
        }
      });

      if (config?.customItems) {
        items.push(...config.customItems);
      }

      // Reorganize items by groups to ensure keyboard navigation works correctly
      return organizeItemsByGroups(items, showGroups);
    },
    [config],
  );

  return {
    getSlashMenuItems,
    config,
  };
}

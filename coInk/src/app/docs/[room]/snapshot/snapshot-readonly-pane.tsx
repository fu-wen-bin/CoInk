'use client';

import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';

import './snapshot-readonly.css';
/* 与 notion-like-editor.tsx 对齐，保证段落/标题/表格/图片等节点样式一致 */
import '@/components/tiptap-node/table-node/styles/prosemirror-table.scss';
import '@/components/tiptap-node/table-node/styles/table-node.scss';
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '@/components/tiptap-node/code-block-node/code-block-node.scss';
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '@/components/tiptap-node/list-node/list-node.scss';
import '@/components/tiptap-node/image-node/image-node.scss';
import '@/components/tiptap-node/heading-node/heading-node.scss';
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss';
import '@/components/tiptap-templates/notion-like/notion-like-editor.scss';

import { StaticExtensionKit } from '@/extensions/extension-kit';
import { cn } from '@/utils';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

function toDocJson(content: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (content && typeof content === 'object' && (content as { type?: string }).type === 'doc') {
    return content;
  }
  return emptyDoc;
}

export interface SnapshotReadonlyPaneProps {
  /** TipTap JSON（doc） */
  content: Record<string, unknown> | null | undefined;
  className?: string;
}

/**
 * 历史版本页：只读 TipTap，与编辑页相同的 DOM 结构（notion-like-editor-content）与节点样式表；
 * 勿使用 Tailwind `prose`，否则会覆盖段落/标题等 SCSS。
 */
export function SnapshotReadonlyPane({ content, className }: SnapshotReadonlyPaneProps) {
  const serialized = useMemo(() => JSON.stringify(content ?? null), [content]);

  const editor = useEditor(
    {
      extensions: StaticExtensionKit,
      content: toDocJson(content),
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'notion-like-editor min-h-[12rem] max-w-none focus:outline-none',
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    try {
      const parsed = JSON.parse(serialized) as Record<string, unknown> | null;
      editor.commands.setContent(toDocJson(parsed));
    } catch {
      editor.commands.setContent(emptyDoc);
    }
  }, [editor, serialized]);

  if (!editor) {
    return (
      <div
        className="min-h-[12rem] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        'notion-like-editor-wrapper snapshot-readonly flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
        className,
      )}
    >
      <div
        className="notion-like-editor-layout min-h-0 flex-1"
        data-page-width="default"
        data-sidebar-open="false"
      >
        <EditorContent
          editor={editor}
          role="presentation"
          className="notion-like-editor-content min-h-0 min-w-0 flex-1 overflow-y-auto"
        />
      </div>
    </div>
  );
}

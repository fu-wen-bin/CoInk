'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface TemplatePreviewProps {
  content: Record<string, unknown>;
}

export function TemplatePreview({ content }: TemplatePreviewProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
  });

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-gray-800">
      <EditorContent editor={editor} className="prose dark:prose-invert max-w-none" />
    </div>
  );
}

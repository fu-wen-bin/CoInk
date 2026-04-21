'use client';

import { ThemeToggle } from '@/components/tiptap-templates/notion-like/notion-like-editor-theme-toggle';

// --- Tiptap UI ---
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button';
import { ArrowDownToLineIcon } from '@/components/tiptap-icons/arrow-down-to-line-icon';
import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { openDocumentImportPicker } from '@/lib/editor-document-import';

// --- UI Primitives ---
import { Spacer } from '@/components/tiptap-ui-primitive/spacer';
import { Separator } from '@/components/tiptap-ui-primitive/separator';
import { Button, ButtonGroup } from '@/components/tiptap-ui-primitive/button';

// --- Styles ---
import '@/components/tiptap-templates/notion-like/notion-like-editor-header.scss';

import { CollaborationUsers } from '@/components/tiptap-templates/notion-like/notion-like-editor-collaboration-users';

function ImportDocumentButton() {
  const { editor } = useTiptapEditor();
  if (!editor || !editor.isEditable) return null;

  return (
    <Button
      type="button"
      data-style="ghost"
      tooltip="导入文档"
      aria-label="导入文档"
      onClick={() => openDocumentImportPicker(editor)}
    >
      <ArrowDownToLineIcon className="tiptap-button-icon" />
    </Button>
  );
}

export function NotionEditorHeader() {
  return (
    <header className="notion-like-editor-header">
      <Spacer />
      <div className="notion-like-editor-header-actions">
        <ButtonGroup orientation="horizontal">
          <ImportDocumentButton />
          <UndoRedoButton action="undo" />
          <UndoRedoButton action="redo" />
        </ButtonGroup>

        <Separator />

        <ThemeToggle />

        <Separator />

        <CollaborationUsers />
      </div>
    </header>
  );
}

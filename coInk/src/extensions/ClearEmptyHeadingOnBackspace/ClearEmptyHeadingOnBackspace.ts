import { Extension } from '@tiptap/core';

/**
 * 空标题行按退格时转为正文，而不是与上一块合并或删掉整行。
 */
export const ClearEmptyHeadingOnBackspace = Extension.create({
  name: 'clearEmptyHeadingOnBackspace',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;

        const parent = selection.$from.parent;
        if (parent.type.name !== 'heading') return false;
        if (parent.content.size > 0) return false;

        return editor.chain().focus().setParagraph().run();
      },
    };
  },
});

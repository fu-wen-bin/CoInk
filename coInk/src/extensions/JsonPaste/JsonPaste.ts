import { Extension } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const JsonPaste = Extension.create({
  name: 'jsonPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('jsonPaste'),
        props: {
          handleDOMEvents: {
            paste: (view, event: ClipboardEvent) => {
              const text = event.clipboardData?.getData('text/json') ?? '';

              if (!text.trim()) {
                return false;
              }

              try {
                const json = JSON.parse(text);

                if (!json || typeof json !== 'object') {
                  return false;
                }

                event.preventDefault();

                const node = view.state.schema.nodeFromJSON(json);
                const tr = view.state.tr;

                if (node.type.name === 'doc') {
                  tr.replaceSelection(new Slice(node.content, 0, 0));
                } else {
                  tr.replaceSelectionWith(node);
                }

                view.dispatch(tr.scrollIntoView());

                return true;
              } catch (error) {
                console.error('粘贴 JSON 失败:', error);

                return false;
              }
            },
          },
        },
      }),
    ];
  },
});

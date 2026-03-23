import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface UiState {
  aiGenerationIsSelection: boolean;
  aiGenerationIsLoading: boolean;
  aiGenerationActive: boolean;
  aiGenerationHasMessage: boolean;
  commentInputVisible: boolean;
  lockDragHandle: boolean;
  isDragging: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    uiState: {
      aiGenerationSetIsSelection: (value: boolean) => ReturnType;
      aiGenerationSetIsLoading: (value: boolean) => ReturnType;
      aiGenerationShow: () => ReturnType;
      aiGenerationHide: () => ReturnType;
      aiGenerationHasMessage: (value: boolean) => ReturnType;

      commentInputShow: () => ReturnType;
      commentInputHide: () => ReturnType;

      setLockDragHandle: (value: boolean) => ReturnType;

      resetUiState: () => ReturnType;
      setIsDragging: (value: boolean) => ReturnType;
    };
  }

  interface Storage {
    uiState: UiState;
  }
}

export const defaultUiState: UiState = {
  aiGenerationIsSelection: false,
  aiGenerationIsLoading: false,
  aiGenerationActive: false,
  aiGenerationHasMessage: false,
  commentInputVisible: false,
  lockDragHandle: false,
  isDragging: false,
} as const;

/**
 * `useEditorState`（如 useUiEditorState）只在 editor 触发 `transaction` 时刷新。
 * 若只改 extension storage 而不 dispatch，React 不会重绘，AI 加载动画与操作栏会永远不更新。
 */
function dispatchUiStateSync(editor: Editor) {
  editor.view.dispatch(editor.state.tr);
}

export const UiState = Extension.create<UiState>({
  name: 'uiState',

  addStorage() {
    return { ...defaultUiState };
  },

  addCommands() {
    const createBooleanSetter = (key: keyof UiState) => (value: boolean) => () => {
      this.storage[key] = value;
      dispatchUiStateSync(this.editor);
      return true;
    };

    const createToggle = (key: keyof UiState, value: boolean) => () => () => {
      this.storage[key] = value;
      dispatchUiStateSync(this.editor);
      return true;
    };

    return {
      aiGenerationSetIsSelection: createBooleanSetter('aiGenerationIsSelection'),
      aiGenerationSetIsLoading: createBooleanSetter('aiGenerationIsLoading'),
      aiGenerationHasMessage: createBooleanSetter('aiGenerationHasMessage'),
      aiGenerationShow: createToggle('aiGenerationActive', true),
      aiGenerationHide: createToggle('aiGenerationActive', false),

      commentInputShow: createToggle('commentInputVisible', true),
      commentInputHide: createToggle('commentInputVisible', false),

      setLockDragHandle: createBooleanSetter('lockDragHandle'),
      setIsDragging: createBooleanSetter('isDragging'),

      resetUiState: () => () => {
        Object.assign(this.storage, { ...defaultUiState });
        dispatchUiStateSync(this.editor);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      /**
       * @tiptap/extension-drag-handle：顶层块增删后 view.update 里用 mapping 更新 currentNodePos，
       * 在「悬浮块菜单已打开(lockDragHandle)」等情况下 keydown 不会清空柄状态，易出现错位。
       * doc 直接子块数量变化时派发 hideDragHandle，与官方插件一致地重置，下次 mousemove 再对齐。
       */
      new Plugin({
        key: new PluginKey('dragHandleResetAfterDocStructureChange'),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (oldState.doc.childCount === newState.doc.childCount) return null;
          return newState.tr.setMeta('hideDragHandle', true);
        },
      }),
    ];
  },
});

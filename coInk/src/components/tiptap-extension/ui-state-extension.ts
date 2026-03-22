import { Extension, type Editor } from '@tiptap/core';

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
});

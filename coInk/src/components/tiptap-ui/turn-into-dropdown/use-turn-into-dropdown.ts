'use client';

import { useCallback, useState } from 'react';
import { NodeSelection } from '@tiptap/pm/state';
import { type Editor, useEditorState } from '@tiptap/react';

import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { ChevronDownIcon } from '@/components/tiptap-icons/chevron-down-icon';
import type { Level } from '@/components/tiptap-ui/heading-button';

export const TURN_INTO_BLOCKS = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
];

/**
 * Configuration for the turn into dropdown functionality
 */
export interface UseTurnIntoDropdownConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null;
  /**
   * Whether the dropdown should hide when no options are available.
   * @default false
   */
  hideWhenUnavailable?: boolean;
  /**
   * Which block types to show in the dropdown
   * @default ["paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock"]
   */
  blockTypes?: string[];
  /**
   * Callback function called when the dropdown state changes.
   */
  onOpenChange?: (isOpen: boolean) => void;
}

export const blockTypeOptions = [
  {
    type: 'paragraph',
    label: '正文',
    isActive: (editor: Editor) =>
      editor.isActive('paragraph') &&
      !editor.isActive('heading') &&
      !editor.isActive('bulletList') &&
      !editor.isActive('orderedList') &&
      !editor.isActive('taskList') &&
      !editor.isActive('blockquote') &&
      !editor.isActive('codeBlock'),
  },
  {
    type: 'heading',
    label: '一级标题',
    level: 1 as Level,
    isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    type: 'heading',
    label: '二级标题',
    level: 2 as Level,
    isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    type: 'heading',
    label: '三级标题',
    level: 3 as Level,
    isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    type: 'bulletList',
    label: '无序列表',
    isActive: (editor: Editor) => editor.isActive('bulletList'),
  },
  {
    type: 'orderedList',
    label: '有序列表',
    isActive: (editor: Editor) => editor.isActive('orderedList'),
  },
  {
    type: 'taskList',
    label: '任务列表',
    isActive: (editor: Editor) => editor.isActive('taskList'),
  },
  {
    type: 'blockquote',
    label: '引用',
    isActive: (editor: Editor) => editor.isActive('blockquote'),
  },
  {
    type: 'codeBlock',
    label: '代码块',
    isActive: (editor: Editor) => editor.isActive('codeBlock'),
  },
];

/**
 * Checks if turn into functionality can be used in the current editor state
 */
export function canTurnInto(editor: Editor | null, allowedBlockTypes?: string[]): boolean {
  if (!editor || !editor.isEditable) return false;

  const blockTypes = allowedBlockTypes || TURN_INTO_BLOCKS;
  const { selection } = editor.state;

  if (selection instanceof NodeSelection) {
    const nodeType = selection.node.type.name;
    return blockTypes.includes(nodeType);
  }

  const { $anchor } = selection;
  const nodeType = $anchor.parent.type.name;
  return blockTypes.includes(nodeType);
}

/**
 * Gets filtered block type options based on available types
 */
export function getFilteredBlockTypeOptions(blockTypes?: string[]) {
  if (!blockTypes) return blockTypeOptions;

  return blockTypeOptions.filter((option) => {
    return blockTypes.includes(option.type);
  });
}

/**
 * Gets the currently active block type from the available options
 */
export function getActiveBlockType(editor: Editor | null, blockTypes?: string[]) {
  if (!editor) return getFilteredBlockTypeOptions(blockTypes)[0];

  const filteredOptions = getFilteredBlockTypeOptions(blockTypes);
  const activeOption = filteredOptions.find((option) => option.isActive(editor));
  return activeOption || filteredOptions[0];
}

/**
 * Determines if the turn into dropdown should be visible
 */
export function shouldShowTurnInto(params: {
  editor: Editor | null;
  hideWhenUnavailable: boolean;
  blockTypes?: string[];
}): boolean {
  const { editor, hideWhenUnavailable, blockTypes } = params;

  if (!editor) {
    return false;
  }

  if (hideWhenUnavailable && !editor.isActive('code')) {
    return canTurnInto(editor, blockTypes);
  }

  return true;
}

/**
 * Custom hook that provides turn into dropdown functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyTurnIntoDropdown() {
 *   const {
 *     isVisible,
 *     canToggle,
 *     activeBlockType,
 *     handleOpenChange,
 *     label,
 *     Icon,
 *   } = useTurnIntoDropdown()
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <DropdownMenu onOpenChange={handleOpenChange}>
 *       // dropdown content
 *     </DropdownMenu>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedTurnIntoDropdown() {
 *   const {
 *     isVisible,
 *     activeBlockType,
 *   } = useTurnIntoDropdown({
 *     editor: myEditor,
 *     blockTypes: ["paragraph", "heading", "bulletList"],
 *     hideWhenUnavailable: true,
 *     onOpenChange: (isOpen) => console.log("Dropdown toggled", isOpen),
 *   })
 *
 *   // component implementation
 * }
 * ```
 */
export function useTurnIntoDropdown(config?: UseTurnIntoDropdownConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    blockTypes,
    onOpenChange,
  } = config || {};

  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = useState(false);

  const blockUi = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) {
        return {
          isVisible: false,
          canToggle: false,
          activeBlockType: getFilteredBlockTypeOptions(blockTypes)[0],
        };
      }
      return {
        isVisible: shouldShowTurnInto({
          editor: ed,
          hideWhenUnavailable,
          blockTypes,
        }),
        canToggle: canTurnInto(ed, blockTypes),
        activeBlockType: getActiveBlockType(ed, blockTypes),
      };
    },
  });

  const isVisible = blockUi?.isVisible ?? false;
  const canToggle = blockUi?.canToggle ?? false;
  const activeBlockType = blockUi?.activeBlockType;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!editor || !canToggle) return;
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [canToggle, editor, onOpenChange],
  );

  return {
    isVisible,
    canToggle,
    isOpen,
    setIsOpen,
    activeBlockType,
    handleOpenChange,
    filteredOptions: getFilteredBlockTypeOptions(blockTypes),
    label: `转换为（当前：${activeBlockType?.label || '正文'}）`,
    Icon: ChevronDownIcon,
  };
}

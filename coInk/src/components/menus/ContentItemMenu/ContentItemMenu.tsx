import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { Editor, isTextSelection, isNodeSelection } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Node } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { offset } from '@floating-ui/dom';

import useContentItemActions from './hooks/useContentItemActions';
import { useData } from './hooks/useData';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Toolbar } from '@/components/ui/Toolbar';
import { Surface } from '@/components/ui/Surface';
import { DropdownButton } from '@/components/ui/Dropdown';
import { useEditorStore } from '@/stores/editorStore';

const DRAG_HANDLE_OFFSET = 16;

export type ContentItemMenuProps = {
  editor: Editor;
  isEditable?: boolean;
};

function getNodeIcon(node: Node | null): IconName {
  if (!node) return 'Pilcrow';

  switch (node.type.name) {
    case 'heading': {
      const level = node.attrs.level as number;
      const map: Record<number, IconName> = {
        1: 'Heading1',
        2: 'Heading2',
        3: 'Heading3',
        4: 'Heading4',
        5: 'Heading5',
        6: 'Heading6',
      };
      return map[level] || 'Heading';
    }
    case 'bulletList':
      return 'List';
    case 'orderedList':
      return 'ListOrdered';
    case 'taskList':
    case 'taskItem':
      return 'ListTodo';
    case 'codeBlock':
      return 'Code';
    case 'blockquote':
      return 'Quote';
    case 'horizontalRule':
      return 'Minus';
    case 'imageBlock':
    case 'image':
      return 'Image';
    case 'table':
      return 'Table';
    case 'details':
      return 'ChevronRight';
    default:
      return 'Pilcrow';
  }
}

function isTextSelectionActive(editor: Editor): boolean {
  const { selection } = editor.state;

  return isTextSelection(selection) && !selection.empty && !isNodeSelection(selection);
}

function selectNodeAndHideFloating(editor: Editor, pos: number) {
  const { state, view } = editor;

  view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
}

export const ContentItemMenu = ({ editor, isEditable = true }: ContentItemMenuProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const data = useData();
  const actions = useContentItemActions(editor, data.currentNode, data.currentNodePos);
  const { setIsContentItemMenuOpen, isHeaderHovered } = useEditorStore();

  const nodeIcon = useMemo(() => getNodeIcon(data.currentNode), [data.currentNode]);

  const computePositionConfig = useMemo(
    () => ({
      placement: 'left-start' as const,
      strategy: 'absolute' as const,
      middleware: [
        offset((state) => {
          const nodeHeight = state.rects.reference.height;
          const handleHeight = state.rects.floating.height;
          const crossAxis = nodeHeight / 2 - handleHeight / 2;

          return {
            mainAxis: DRAG_HANDLE_OFFSET,
            crossAxis: nodeHeight > 40 ? 0 : crossAxis,
          };
        }),
      ],
    }),
    [],
  );

  useEffect(() => {
    if (editor.isDestroyed) return;
    editor.commands.setMeta('lockDragHandle', menuOpen);
    setIsContentItemMenuOpen(menuOpen);
  }, [editor, menuOpen, setIsContentItemMenuOpen]);

  useEffect(() => {
    const handleWindowResize = () => {
      if (menuOpen || editor.isDestroyed) return;
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) {
          editor.view.dispatch(editor.state.tr.setMeta('hideDragHandle', true));
        }
      });
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [editor, menuOpen]);

  const handleSelectNode = useCallback(() => {
    if (data.currentNodePos !== -1) {
      selectNodeAndHideFloating(editor, data.currentNodePos);
    }
  }, [editor, data.currentNodePos]);

  const handleMenuClose = useCallback(() => {
    editor.commands.setMeta('hideDragHandle', true);
  }, [editor]);

  const onElementDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onElementDragEnd = useCallback(() => {
    setIsDragging(false);
    setTimeout(() => {
      editor.view.dom.blur();
      editor.view.focus();
    }, 0);
  }, [editor]);

  const hasTextSelection = isTextSelectionActive(editor);
  const shouldHide = !isEditable || isHeaderHovered || hasTextSelection;

  return (
    <DragHandle
      pluginKey="ContentItemMenu"
      editor={editor}
      onNodeChange={data.handleNodeChange}
      computePositionConfig={computePositionConfig}
      onElementDragStart={onElementDragStart}
      onElementDragEnd={onElementDragEnd}
    >
      {!shouldHide ? (
        <div
          className="flex items-center gap-0.5"
          style={{
            ...(isDragging ? { opacity: 0, pointerEvents: 'none' as const } : {}),
          }}
        >
          <button
            type="button"
            onClick={actions.handleAIContinue}
            className="flex items-center justify-center w-7 h-7 rounded-md text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <Icon name="Wand2" className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSelectNode}
            className="drag-handle-btn flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name={nodeIcon} className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </button>

          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{
                  cursor: 'grab',
                  ...(menuOpen ? { pointerEvents: 'none' as const } : {}),
                }}
                onMouseDown={handleSelectNode}
              >
                <Icon
                  name="GripVertical"
                  className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
                />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="start"
                sideOffset={8}
                className="z-50"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  handleMenuClose();
                }}
              >
                <Surface className="p-1.5 flex flex-col min-w-[15rem] rounded-lg" elevation="high">
                  <Popover.Close asChild>
                    <DropdownButton onClick={actions.handleAdd}>
                      <Icon name="Plus" />
                      添加块
                    </DropdownButton>
                  </Popover.Close>
                  <Toolbar.Divider horizontal />
                  <Popover.Close asChild>
                    <DropdownButton onClick={actions.resetTextFormatting}>
                      <Icon name="RemoveFormatting" />
                      清除格式
                    </DropdownButton>
                  </Popover.Close>
                  <Popover.Close asChild>
                    <DropdownButton onClick={actions.copyNodeToClipboard}>
                      <Icon name="Clipboard" />
                      复制到剪贴板
                    </DropdownButton>
                  </Popover.Close>
                  <Popover.Close asChild>
                    <DropdownButton onClick={actions.duplicateNode}>
                      <Icon name="Copy" />
                      复制块
                    </DropdownButton>
                  </Popover.Close>
                  <Toolbar.Divider horizontal />
                  <Popover.Close asChild>
                    <DropdownButton
                      onClick={actions.deleteNode}
                      className="text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                    >
                      <Icon name="Trash2" />
                      删除
                    </DropdownButton>
                  </Popover.Close>
                </Surface>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ) : null}
    </DragHandle>
  );
};

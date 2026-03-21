'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Node as TiptapNode } from '@tiptap/pm/model';
import { offset } from '@floating-ui/react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import {
  Braces,
  ChevronRight,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image,
  IndentIncrease,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Plus,
  Quote,
  Repeat2,
  Table,
  Type,
} from 'lucide-react';

// Hooks
import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { useIsBreakpoint } from '@/hooks/use-is-breakpoint';
import { useUiEditorState } from '@/hooks/use-ui-editor-state';
import { selectNodeAndHideFloating } from '@/hooks/use-floating-toolbar-visibility';
// Primitive UI Components
import { Button } from '@/components/tiptap-ui-primitive/button';
import { Spacer } from '@/components/tiptap-ui-primitive/spacer';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuButton,
} from '@/components/tiptap-ui-primitive/menu';
import { Combobox, ComboboxList } from '@/components/tiptap-ui-primitive/combobox';
import { Separator } from '@/components/tiptap-ui-primitive/separator';
// Tiptap UI
import { useImageDownload } from '@/components/tiptap-ui/image-download-button';
import { DuplicateShortcutBadge, useDuplicate } from '@/components/tiptap-ui/duplicate-button';
import {
  CopyToClipboardShortcutBadge,
  useCopyToClipboard,
} from '@/components/tiptap-ui/copy-to-clipboard-button';
import { DeleteNodeShortcutBadge, useDeleteNode } from '@/components/tiptap-ui/delete-node-button';
import {
  CopyAnchorLinkShortcutBadge,
  useCopyAnchorLink,
} from '@/components/tiptap-ui/copy-anchor-link-button';
import { useResetAllFormatting } from '@/components/tiptap-ui/reset-all-formatting-button';
import { useText } from '@/components/tiptap-ui/text-button';
import { useHeading } from '@/components/tiptap-ui/heading-button';
import { useList } from '@/components/tiptap-ui/list-button';
import { useBlockquote } from '@/components/tiptap-ui/blockquote-button';
import { useCodeBlock } from '@/components/tiptap-ui/code-block-button';
import { ColorMenu } from '@/components/tiptap-ui/color-menu';
import { TableAlignMenu } from '@/components/tiptap-node/table-node/ui/table-alignment-menu';
import { useTableFitToWidth } from '@/components/tiptap-node/table-node/ui/table-fit-to-width-button';
import { useTableClearRowColumnContent } from '@/components/tiptap-node/table-node/ui/table-clear-row-column-content-button';
// Utils
import { getNodeDisplayName, isTextSelectionValid } from '@/lib/tiptap-collab-utils';
import { SR_ONLY } from '@/lib/tiptap-utils';
import { useEditorStore } from '@/stores/editorStore';
import type {
  DragContextMenuProps,
  MenuItemProps,
  NodeChangeData,
} from '@/components/tiptap-ui/drag-context-menu/drag-context-menu-types';
import { Label } from '@/components/tiptap-ui-primitive/label';
import { useTocShowTitle } from '@/components/tiptap-node/toc-node/ui/toc-show-title-button';
import { insertSlashCommand } from '@/components/tiptap-ui/slash-command-trigger-button';
import './drag-context-menu.scss';

/**
 * 固定槽宽 + 触发器 `absolute right-0`：各行按钮**右缘**与同槽右边界对齐，
 * 不受「仅加号」与「类型+握把」宽度差或 Menu 内部包裹层影响。
 */
const DRAG_HANDLE_GUTTER_CLASS = 'relative h-7 w-[7.5rem] shrink-0';
const DRAG_HANDLE_TRIGGER_PIN_CLASS =
  'absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-end';
const DRAG_HANDLE_CONTROL_CLASS =
  'drag-handle-btn box-border flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800';

function isEmptyLineBlockNode(node: TiptapNode | null): boolean {
  if (!node) return false;
  const name = node.type.name;
  if (name === 'paragraph' || name === 'heading') {
    return node.content.size === 0;
  }
  if (name === 'blockquote') {
    if (node.childCount === 1) {
      const c = node.child(0);
      return c.type.name === 'paragraph' && c.content.size === 0;
    }
    return false;
  }
  if (name === 'listItem') {
    if (node.childCount !== 1) return false;
    const c = node.child(0);
    return c.type.name === 'paragraph' && c.content.size === 0;
  }
  if (name === 'taskItem') {
    const p = node.childCount > 0 ? node.child(0) : null;
    return p?.type.name === 'paragraph' && p.content.size === 0;
  }
  return false;
}

function dragHandleIconColorClass(node: TiptapNode | null): string {
  if (!node) return 'text-blue-600 dark:text-blue-400';
  switch (node.type.name) {
    case 'heading':
      return 'text-violet-600 dark:text-violet-400';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
    case 'taskItem':
    case 'listItem':
      return 'text-sky-600 dark:text-sky-400';
    case 'codeBlock':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'blockquote':
      return 'text-amber-600 dark:text-amber-400';
    case 'horizontalRule':
      return 'text-gray-500 dark:text-gray-400';
    case 'image':
    case 'imageUpload':
      return 'text-purple-600 dark:text-purple-400';
    case 'table':
      return 'text-orange-600 dark:text-orange-400';
    case 'details':
    case 'tocNode':
      return 'text-slate-600 dark:text-slate-400';
    case 'paragraph':
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

/** 左侧节点类型图标：按块类型区分颜色；代码块/引用使用 Lucide 花括号与引号图标 */
function DragHandleNodeIcon({ node }: { node: TiptapNode | null }) {
  const colorCls = dragHandleIconColorClass(node);
  const sizeCls = 'h-[18px] w-[18px] shrink-0';
  const combined = `${sizeCls} ${colorCls}`;
  const stroke = 2 as const;
  if (!node) {
    return <Type className={combined} strokeWidth={stroke} />;
  }
  switch (node.type.name) {
    case 'heading': {
      const level = node.attrs.level as number;
      if (level === 1) return <Heading1 className={combined} strokeWidth={stroke} />;
      if (level === 2) return <Heading2 className={combined} strokeWidth={stroke} />;
      if (level === 3) return <Heading3 className={combined} strokeWidth={stroke} />;
      return <Heading1 className={combined} strokeWidth={stroke} />;
    }
    case 'bulletList':
      return <List className={combined} strokeWidth={stroke} />;
    case 'listItem':
      return <List className={combined} strokeWidth={stroke} />;
    case 'orderedList':
      return <ListOrdered className={combined} strokeWidth={stroke} />;
    case 'taskList':
    case 'taskItem':
      return <ListTodo className={combined} strokeWidth={stroke} />;
    case 'codeBlock':
      return <Braces className={combined} strokeWidth={stroke} />;
    case 'blockquote':
      return <Quote className={combined} strokeWidth={stroke} />;
    case 'horizontalRule':
      return <Minus className={combined} strokeWidth={stroke} />;
    case 'image':
    case 'imageUpload':
      return <Image className={combined} strokeWidth={stroke} />;
    case 'table':
      return <Table className={combined} strokeWidth={stroke} />;
    case 'details':
      return <IndentIncrease className={combined} strokeWidth={stroke} />;
    case 'tocNode':
      return <IndentIncrease className={combined} strokeWidth={stroke} />;
    default:
      return <Type className={combined} strokeWidth={stroke} />;
  }
}

const useNodeTransformActions = () => {
  const text = useText();
  const heading1 = useHeading({ level: 1 });
  const heading2 = useHeading({ level: 2 });
  const heading3 = useHeading({ level: 3 });
  const bulletList = useList({ type: 'bulletList' });
  const orderedList = useList({ type: 'orderedList' });
  const taskList = useList({ type: 'taskList' });
  const blockquote = useBlockquote();
  const codeBlock = useCodeBlock();

  const mapper = (
    action: ReturnType<
      | typeof useText
      | typeof useHeading
      | typeof useList
      | typeof useBlockquote
      | typeof useCodeBlock
    >,
  ) => ({
    icon: action.Icon,
    label: action.label,
    onClick: action.handleToggle,
    disabled: !action.canToggle,
    isActive: action.isActive,
  });

  const actions = [
    mapper(text),
    ...[heading1, heading2, heading3].map(mapper),
    mapper(bulletList),
    mapper(orderedList),
    mapper(taskList),
    mapper(blockquote),
    mapper(codeBlock),
  ];

  const allDisabled = actions.every((a) => a.disabled);

  return allDisabled ? null : actions;
};

const BaseMenuItem: React.FC<MenuItemProps> = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  isActive = false,
  shortcutBadge,
}) => (
  <MenuItem
    render={<Button data-style="ghost" data-active-state={isActive ? 'on' : 'off'} />}
    onClick={onClick}
    disabled={disabled}
  >
    <Icon className="tiptap-button-icon" />
    <span className="tiptap-button-text">{label}</span>
    {shortcutBadge}
  </MenuItem>
);

const SubMenuTrigger: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}> = ({ icon: Icon, label, children }) => (
  <Menu
    placement="right"
    trigger={
      <MenuItem
        render={
          <MenuButton
            render={
              <Button data-style="ghost">
                <Icon className="tiptap-button-icon" />
                <span className="tiptap-button-text">{label}</span>
                <Spacer />
                <ChevronRight className="tiptap-button-icon" strokeWidth={2} />
              </Button>
            }
          />
        }
      />
    }
  >
    <MenuContent portal>
      <ComboboxList>{children}</ComboboxList>
    </MenuContent>
  </Menu>
);

const TransformActionGroup: React.FC = () => {
  const actions = useNodeTransformActions();
  const { canReset, handleResetFormatting, label, Icon } = useResetAllFormatting({
    hideWhenUnavailable: true,
    preserveMarks: ['inlineThread'],
  });

  if (!actions && !canReset) return null;

  return (
    <>
      {actions && (
        <SubMenuTrigger icon={Repeat2} label="转换为">
          <MenuGroup>
            <MenuGroupLabel>转换为</MenuGroupLabel>
            {actions.map((action) => (
              <BaseMenuItem key={action.label} {...action} />
            ))}
          </MenuGroup>
        </SubMenuTrigger>
      )}

      {canReset && (
        <BaseMenuItem
          icon={Icon}
          label={label}
          disabled={!canReset}
          onClick={handleResetFormatting}
        />
      )}
    </>
  );
};

const TableFitToWidth: React.FC = () => {
  const { canFitToWidth, handleFitToWidth, label, Icon } = useTableFitToWidth({
    hideWhenUnavailable: true,
  });
  const clearAllContents = useTableClearRowColumnContent({ resetAttrs: true });

  return (
    <>
      {canFitToWidth && (
        <BaseMenuItem
          icon={Icon}
          label={label}
          disabled={!canFitToWidth}
          onClick={handleFitToWidth}
        />
      )}

      {clearAllContents.canClearRowColumnContent && (
        <BaseMenuItem
          icon={clearAllContents.Icon}
          label={'清空全部内容'}
          disabled={!clearAllContents.canClearRowColumnContent}
          onClick={clearAllContents.handleClear}
        />
      )}
    </>
  );
};

const TocShowTitle: React.FC = () => {
  const { canToggle, handleToggle, label, Icon } = useTocShowTitle({
    hideWhenUnavailable: true,
  });

  if (!canToggle) return null;

  return <BaseMenuItem icon={Icon} label={label} disabled={!canToggle} onClick={handleToggle} />;
};

const ImageActionGroup: React.FC = () => {
  const { canDownload, handleDownload, label, Icon } = useImageDownload({
    hideWhenUnavailable: true,
  });

  if (!canDownload) return null;

  return (
    <BaseMenuItem icon={Icon} label={label} disabled={!canDownload} onClick={handleDownload} />
  );
};

const CoreActionGroup: React.FC = () => {
  const { handleDuplicate, canDuplicate, label, Icon: DuplicateIcon } = useDuplicate();
  const {
    handleCopyToClipboard,
    canCopyToClipboard,
    label: copyLabel,
    Icon: CopyIcon,
  } = useCopyToClipboard();
  const {
    handleCopyAnchorLink,
    canCopyAnchorLink,
    label: copyAnchorLinkLabel,
    Icon: CopyAnchorLinkIcon,
  } = useCopyAnchorLink();

  return (
    <>
      <Separator orientation="horizontal" />

      <MenuGroup>
        <BaseMenuItem
          icon={DuplicateIcon}
          label={label}
          onClick={handleDuplicate}
          disabled={!canDuplicate}
          shortcutBadge={<DuplicateShortcutBadge />}
        />
        <BaseMenuItem
          icon={CopyIcon}
          label={copyLabel}
          onClick={handleCopyToClipboard}
          disabled={!canCopyToClipboard}
          shortcutBadge={<CopyToClipboardShortcutBadge />}
        />
        <BaseMenuItem
          icon={CopyAnchorLinkIcon}
          label={copyAnchorLinkLabel}
          onClick={handleCopyAnchorLink}
          disabled={!canCopyAnchorLink}
          shortcutBadge={<CopyAnchorLinkShortcutBadge />}
        />
      </MenuGroup>

      <Separator orientation="horizontal" />
    </>
  );
};

const DeleteActionGroup: React.FC = () => {
  const { handleDeleteNode, canDeleteNode, label, Icon } = useDeleteNode();

  return (
    <MenuGroup>
      <BaseMenuItem
        icon={Icon}
        label={label}
        onClick={handleDeleteNode}
        disabled={!canDeleteNode}
        shortcutBadge={<DeleteNodeShortcutBadge />}
      />
    </MenuGroup>
  );
};

export const DragContextMenu: React.FC<DragContextMenuProps> = ({
  editor: providedEditor,
  withSlashCommandTrigger: _withSlashCommandTrigger = false,
  mobileBreakpoint = 768,
  ...props
}) => {
  void _withSlashCommandTrigger;

  const { editor } = useTiptapEditor(providedEditor);
  const { aiGenerationActive, isDragging } = useUiEditorState(editor);
  const { setIsContentItemMenuOpen, isHeaderHovered } = useEditorStore();
  const isMobile = useIsBreakpoint('max', mobileBreakpoint);
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<TiptapNode | null>(null);
  const [nodePos, setNodePos] = useState<number>(-1);

  const handleNodeChange = useCallback((data: NodeChangeData) => {
    if (data.node) setNode(data.node);
    setNodePos(data.pos);
  }, []);

  const isEmptyLine = useMemo(() => isEmptyLineBlockNode(node), [node]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setLockDragHandle(open);
    editor.commands.setMeta('lockDragHandle', open);
    setIsContentItemMenuOpen(open);
  }, [editor, open, setIsContentItemMenuOpen]);

  const mainAxisOffset = 16;

  const dynamicPositions = useMemo(() => {
    return {
      middleware: [
        offset((props) => {
          const { rects } = props;
          const nodeHeight = rects.reference.height;
          const dragHandleHeight = rects.floating.height;

          const crossAxis = nodeHeight / 2 - dragHandleHeight / 2;

          return {
            mainAxis: mainAxisOffset,
            // if height is more than 40px, then it's likely a block node
            crossAxis: nodeHeight > 40 ? 0 : crossAxis,
          };
        }),
      ],
    };
  }, []);

  const handleOnMenuClose = useCallback(() => {
    if (editor) {
      editor.commands.setMeta('hideDragHandle', true);
    }
  }, [editor]);

  const onElementDragStart = useCallback(() => {
    if (!editor) return;
    editor.commands.setIsDragging(true);
  }, [editor]);

  const onElementDragEnd = useCallback(() => {
    if (!editor) return;
    editor.commands.setIsDragging(false);

    setTimeout(() => {
      editor.view.dom.blur();
      editor.view.focus();
    }, 0);
  }, [editor]);

  if (!editor) return null;

  const nodeName = getNodeDisplayName(editor);
  const shouldHide =
    aiGenerationActive || isMobile || isTextSelectionValid(editor) || isHeaderHovered;

  return (
    <div
      style={
        {
          '--drag-handle-main-axis-offset': `${mainAxisOffset}px`,
        } as React.CSSProperties
      }
    >
      <DragHandle
        editor={editor}
        onNodeChange={handleNodeChange}
        computePositionConfig={dynamicPositions}
        onElementDragStart={onElementDragStart}
        onElementDragEnd={onElementDragEnd}
        {...props}
      >
        <div
          className={DRAG_HANDLE_GUTTER_CLASS}
          style={{
            ...(shouldHide ? { opacity: 0, pointerEvents: 'none' } : {}),
            ...(isDragging ? { opacity: 0, pointerEvents: 'none', cursor: 'grabbing' } : {}),
          }}
        >
          {isEmptyLine ? (
            <div className={DRAG_HANDLE_TRIGGER_PIN_CLASS}>
              <button
                type="button"
                className={DRAG_HANDLE_CONTROL_CLASS}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  insertSlashCommand(editor, '/', node, nodePos >= 0 ? nodePos : null);
                }}
              >
                <Plus
                  className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
                  strokeWidth={2}
                />
              </button>
            </div>
          ) : (
            <div className={DRAG_HANDLE_TRIGGER_PIN_CLASS}>
              <Menu
                open={open}
                onOpenChange={setOpen}
                placement="left"
                trigger={
                  <MenuButton
                    className={DRAG_HANDLE_CONTROL_CLASS}
                    tabIndex={-1}
                    style={{
                      cursor: 'grab',
                      ...(open ? { pointerEvents: 'none' } : {}),
                    }}
                    onMouseDown={() => selectNodeAndHideFloating(editor, nodePos)}
                  >
                    <DragHandleNodeIcon node={node} />
                    <GripVertical
                      className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
                      strokeWidth={2}
                    />
                  </MenuButton>
                }
              >
                <MenuContent
                  onClose={handleOnMenuClose}
                  autoFocusOnHide={false}
                  preventBodyScroll={true}
                  portal
                >
                  <Combobox style={SR_ONLY} />
                  <ComboboxList style={{ minWidth: '15rem' }}>
                    <Label>{nodeName}</Label>

                    <MenuGroup>
                      <TocShowTitle />
                      <ColorMenu />
                      <TableAlignMenu />
                      <TableFitToWidth />
                      <TransformActionGroup />
                      <ImageActionGroup />
                    </MenuGroup>

                    <CoreActionGroup />

                    <DeleteActionGroup />
                  </ComboboxList>
                </MenuContent>
              </Menu>
            </div>
          )}
        </div>
      </DragHandle>
    </div>
  );
};

'use client';

import { useContext, useEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import { Collaboration, isChangeOrigin } from '@tiptap/extension-collaboration';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Mention } from '@tiptap/extension-mention';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap/extension-table-of-contents';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Typography } from '@tiptap/extension-typography';
import { UniqueID } from '@tiptap/extension-unique-id';
import { Selection } from '@tiptap/extensions';
import { AllSelection, NodeSelection, TextSelection, type EditorState } from '@tiptap/pm/state';
import { CellSelection, cellAround, TableMap } from '@tiptap/pm/tables';
import { EditorContent, EditorContext, useEditor, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { createPortal } from 'react-dom';
import type { Doc as YDoc } from 'yjs';

import type { CollaborationUser } from '@/app/docs/_components/DocumentHeader/types';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
import { Image } from '@/components/tiptap-node/image-node/image-node-extension';
import { TableHandleExtension } from '@/components/tiptap-node/table-node/extensions/table-handle';
import { TableKit } from '@/components/tiptap-node/table-node/extensions/table-node-extension';
import { TableCellHandleMenu } from '@/components/tiptap-node/table-node/ui/table-cell-handle-menu';
import { TableExtendRowColumnButtons } from '@/components/tiptap-node/table-node/ui/table-extend-row-column-button';
import { TableHandle } from '@/components/tiptap-node/table-node/ui/table-handle/table-handle';
import { TableSelectionOverlay } from '@/components/tiptap-node/table-node/ui/table-selection-overlay';
import { TocNode } from '@/components/tiptap-node/toc-node/extensions/toc-node-extension';
import { TocProvider, useToc } from '@/components/tiptap-node/toc-node/context/toc-context';
import { TocSidebar } from '@/components/tiptap-node/toc-node';
import { ListNormalizationExtension } from '@/components/tiptap-extension/list-normalization-extension';
import { NodeAlignment } from '@/components/tiptap-extension/node-alignment-extension';
import { NodeBackground } from '@/components/tiptap-extension/node-background-extension';
import { UiState } from '@/components/tiptap-extension/ui-state-extension';
import { AiMenu } from '@/components/tiptap-ui/ai-menu';
import { useScrollToHash } from '@/components/tiptap-ui/copy-anchor-link-button/use-scroll-to-hash';
import { DragContextMenu } from '@/components/tiptap-ui/drag-context-menu';
import { EmojiDropdownMenu } from '@/components/tiptap-ui/emoji-dropdown-menu';
import { MentionDropdownMenu } from '@/components/tiptap-ui/mention-dropdown-menu';
import { SlashDropdownMenu } from '@/components/tiptap-ui/slash-dropdown-menu';
import {
  CharacterCount,
  ClearEmptyHeadingOnBackspace,
  ClearMarksOnEnter,
  CodeBlock,
  Column,
  Columns,
  Details,
  DetailsContent,
  DetailsSummary,
  FixBackspaceAfterImage,
  FontFamily,
  FontSize,
  Link as CoInkLink,
  MathLiveExtension,
  SearchAndReplace,
  TrailingNode,
  Underline,
  FileHandler,
} from '@/extensions';
import { CoInkPlaceholder } from '@/extensions/coink-placeholder';
import { useUiEditorState } from '@/hooks/use-ui-editor-state';
import { EDITOR_AI_ENABLED, createEditorAiExtension } from '@/lib/editor-ai';
import {
  DOCUMENT_IMPORT_ALLOWED_MIME_TYPES,
  importDocumentFileToEditor,
  isSupportedDocumentImportFile,
} from '@/lib/editor-document-import';
import { consumePendingDocumentImport } from '@/lib/pending-document-import';
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils';
import { useEditorStore } from '@/stores/editorStore';
import { useSidebar } from '@/stores/sidebarStore';
import { getAuthToken } from '@/utils';
import { toastError, toastInfo } from '@/utils/toast';
import { NotionEditorHeader } from '@/components/tiptap-templates/notion-like/notion-like-editor-header';
import { MobileToolbar } from '@/components/tiptap-templates/notion-like/notion-like-editor-mobile-toolbar';
import { NotionToolbarFloating } from '@/components/tiptap-templates/notion-like/notion-like-editor-toolbar-floating';

import '@/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '@/components/tiptap-node/code-block-node/code-block-node.scss';
import '@/components/tiptap-node/heading-node/heading-node.scss';
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '@/components/tiptap-node/image-node/image-node.scss';
import '@/components/tiptap-node/list-node/list-node.scss';
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss';
import '@/components/tiptap-node/table-node/styles/prosemirror-table.scss';
import '@/components/tiptap-node/table-node/styles/table-node.scss';
import '@/components/tiptap-templates/notion-like/notion-like-editor.scss';

const SELECT_ALL_EXCLUDED_ANCESTOR_TYPES = new Set([
  'codeBlock',
  'image',
  'imageBlock',
  'tableImage',
]);

function isModA(event: KeyboardEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) return false;
  if (event.altKey) return false;
  const key = event.key?.toLowerCase();
  return key === 'a' || event.code === 'KeyA';
}

function isInsideSelectAllExcludedNode(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if (SELECT_ALL_EXCLUDED_ANCESTOR_TYPES.has($from.node(depth).type.name)) {
      return true;
    }
  }
  return false;
}

function resolveCurrentCellPos(state: EditorState): number | null {
  if (state.selection instanceof CellSelection) {
    return state.selection.$anchorCell.pos;
  }
  const cell = cellAround(state.selection.$anchor);
  return cell ? cell.pos : null;
}

function getTableSelectionInfo(selection: CellSelection) {
  const tableNode = selection.$anchorCell.node(-1);
  const tableStart = selection.$anchorCell.start(-1);
  const map = TableMap.get(tableNode);

  const anchorRect = map.findCell(selection.$anchorCell.pos - tableStart);
  const headRect = map.findCell(selection.$headCell.pos - tableStart);

  const left = Math.min(anchorRect.left, headRect.left);
  const right = Math.max(anchorRect.right, headRect.right);
  const top = Math.min(anchorRect.top, headRect.top);
  const bottom = Math.max(anchorRect.bottom, headRect.bottom);

  return {
    tableStart,
    map,
    left,
    right,
    top,
    bottom,
  };
}

function isWholeTableSelection(selection: CellSelection): boolean {
  const info = getTableSelectionInfo(selection);
  return (
    info.left === 0 &&
    info.top === 0 &&
    info.right === info.map.width &&
    info.bottom === info.map.height
  );
}

function createWholeTableSelection(state: EditorState, selection: CellSelection): CellSelection | null {
  const info = getTableSelectionInfo(selection);
  if (info.map.map.length === 0) return null;

  const firstCellPos = info.tableStart + info.map.map[0];
  const lastCellPos = info.tableStart + info.map.map[info.map.map.length - 1];
  return CellSelection.create(state.doc, firstCellPos, lastCellPos);
}

function resolveTopLevelBlockPos(state: EditorState): number | null {
  const { doc, selection } = state;
  if (doc.childCount === 0) return null;

  const anchorPos = selection instanceof NodeSelection ? selection.from + 1 : selection.from;

  let matchedPos: number | null = null;
  doc.forEach((node, offset) => {
    if (matchedPos !== null) return;
    const from = offset;
    const to = from + node.nodeSize;
    if (anchorPos >= from && anchorPos <= to) {
      matchedPos = from;
    }
  });

  return matchedPos;
}

const SELECT_ALL_BLOCK_VISUAL_CLASS = 'select-all-block-visual';

function syncSelectAllBlockVisualState(editor: Editor | null) {
  if (!editor) return;
  const editorDom = editor.view.dom as HTMLElement;
  const isAllSelected = editor.state.selection instanceof AllSelection;
  editorDom.classList.toggle(SELECT_ALL_BLOCK_VISUAL_CLASS, isAllSelected);
}

export interface NotionEditorProps {
  documentId?: string;
  provider: HocuspocusProvider;
  ydoc: YDoc;
  user: CollaborationUser;
  placeholder?: string;
  editable?: boolean;
  showHeader?: boolean;
  showTocSidebar?: boolean;
  onEditorCreate?: (editor: Editor | null) => void;
}

/**
 * Loading spinner component shown while connecting to the notion server
 */
export function LoadingSpinner({ text = '连接中...' }: { text?: string }) {
  return (
    <div className="spinner-container">
      <div className="spinner-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="spinner-loading-text">{text}</div>
      </div>
    </div>
  );
}

/**
 * EditorContent component that renders the actual editor
 */
export function EditorContentArea() {
  const { editor } = useContext(EditorContext)!;
  const { aiGenerationIsLoading, aiGenerationIsSelection, aiGenerationHasMessage, isDragging } =
    useUiEditorState(editor);

  // Selection based effect to handle AI generation acceptance
  useEffect(() => {
    if (!editor) return;

    if (!aiGenerationIsLoading && aiGenerationIsSelection && aiGenerationHasMessage) {
      const chain = editor.chain().focus() as unknown as {
        aiAccept?: () => { run: () => boolean };
      };
      if (typeof chain.aiAccept === 'function') {
        chain.aiAccept().run();
      }
      editor.commands.resetUiState();
    }
  }, [aiGenerationHasMessage, aiGenerationIsLoading, aiGenerationIsSelection, editor]);

  useScrollToHash();

  if (!editor) {
    return null;
  }

  return (
    <EditorContent
      editor={editor}
      role="presentation"
      className="notion-like-editor-content"
      style={{
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
    >
      <DragContextMenu />
      <AiMenu />
      <EmojiDropdownMenu />
      <MentionDropdownMenu />
      <SlashDropdownMenu />
      <NotionToolbarFloating />
      {createPortal(<MobileToolbar />, document.body)}
    </EditorContent>
  );
}

/**
 * Component that creates and provides the editor instance
 */
export function EditorProvider(props: NotionEditorProps) {
  const {
    documentId,
    provider,
    ydoc,
    user,
    placeholder = '',
    editable = true,
    showHeader = true,
    showTocSidebar = true,
    onEditorCreate,
  } = props;

  const { setTocContent } = useToc();
  const pageWidthMode = useEditorStore((s) => s.pageWidthMode);
  const isDocsSidebarOpen = useSidebar((s) => s.isOpen);
  const consumedImportForDocRef = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: 'notion-like-editor',
      },
      handleKeyDown: (view, event) => {
        if (!isModA(event)) {
          return false;
        }

        const { state } = view;

        const currentCellPos = resolveCurrentCellPos(state);
        if (currentCellPos !== null) {
          event.preventDefault();

          if (state.selection instanceof CellSelection) {
            if (isWholeTableSelection(state.selection)) {
              view.dispatch(state.tr.setSelection(new AllSelection(state.doc)));
              return true;
            }

            const wholeTableSelection = createWholeTableSelection(state, state.selection);
            if (wholeTableSelection) {
              view.dispatch(state.tr.setSelection(wholeTableSelection));
              toastInfo('再按一次全选文章', {
                id: 'editor-select-all-hint',
                duration: 1400,
              });
              return true;
            }

            return false;
          }

          const singleCellSelection = CellSelection.create(state.doc, currentCellPos, currentCellPos);
          view.dispatch(state.tr.setSelection(singleCellSelection));
          toastInfo('再按一次选中整张表格', {
            id: 'editor-select-all-hint',
            duration: 1400,
          });
          return true;
        }

        if (isInsideSelectAllExcludedNode(state)) {
          return false;
        }

        const topLevelPos = resolveTopLevelBlockPos(state);
        if (topLevelPos === null) {
          return false;
        }

        const node = state.doc.nodeAt(topLevelPos);
        if (!node) {
          return false;
        }

        const isCurrentBlockNodeSelection =
          state.selection instanceof NodeSelection && state.selection.from === topLevelPos;
        const isCurrentBlockTextSelection =
          state.selection instanceof TextSelection &&
          state.selection.from === topLevelPos + 1 &&
          state.selection.to === topLevelPos + node.nodeSize - 1;

        if (isCurrentBlockNodeSelection || isCurrentBlockTextSelection) {
          event.preventDefault();
          view.dispatch(state.tr.setSelection(new AllSelection(state.doc)));
          return true;
        }

        event.preventDefault();
        const tr = state.tr;

        if (NodeSelection.isSelectable(node)) {
          tr.setSelection(NodeSelection.create(state.doc, topLevelPos));
        } else {
          const from = topLevelPos + 1;
          const to = topLevelPos + node.nodeSize - 1;
          if (from < to) {
            tr.setSelection(TextSelection.create(state.doc, from, to));
          } else {
            return false;
          }
        }

        view.dispatch(tr);
        toastInfo('再按一次全选文章', {
          id: 'editor-select-all-hint',
          duration: 1400,
        });
        return true;
      },
    },
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        horizontalRule: false,
        codeBlock: false,
        link: false,
        dropcursor: {
          width: 2,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: { id: user.id, name: user.name, color: user.color },
      }),
      CoInkPlaceholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `H${node.attrs.level as number}`;
          }
          return placeholder;
        },
        emptyNodeClass: 'is-empty',
      }),
      Mention,
      Emoji.configure({
        emojis: gitHubEmojis.filter((emoji) => !emoji.name.includes('regional')),
        forceFallbackImages: true,
      }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 120,
        },
      }),
      NodeBackground.configure({
        types: [
          'paragraph',
          'heading',
          'blockquote',
          'taskList',
          'bulletList',
          'orderedList',
          'tableCell',
          'tableHeader',
          'tocNode',
        ],
      }),
      NodeAlignment,
      TextStyle,
      CoInkLink.configure({
        openOnClick: false,
      }),
      Underline,
      CodeBlock,
      FontSize,
      FontFamily,
      Mathematics,
      MathLiveExtension,
      Superscript,
      Subscript,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Selection,
      Image.configure({
        allowBase64: true,
      }),
      Details.configure({
        persist: true,
        HTMLAttributes: {
          class: 'details',
        },
      }),
      DetailsContent,
      DetailsSummary,
      Columns,
      Column,
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate(content) {
          setTocContent(content);
        },
      }),
      TableHandleExtension,
      ListNormalizationExtension,
      FixBackspaceAfterImage,
      ClearEmptyHeadingOnBackspace,
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => {
          toastError(error.message || '图片上传失败');
        },
      }),
      FileHandler.configure({
        allowedMimeTypes: DOCUMENT_IMPORT_ALLOWED_MIME_TYPES,
        onDrop: (currentEditor, files, pos) => {
          files.forEach((file) => {
            if (!isSupportedDocumentImportFile(file)) return;
            void importDocumentFileToEditor(currentEditor, file, {
              source: 'drop',
              insertPosition: pos,
            });
          });
        },
        onPaste: (currentEditor, files) => {
          files.forEach((file) => {
            if (!isSupportedDocumentImportFile(file)) return;
            void importDocumentFileToEditor(currentEditor, file, {
              source: 'paste',
            });
          });
        },
      }),
      UniqueID.configure({
        types: [
          'table',
          'paragraph',
          'bulletList',
          'orderedList',
          'taskList',
          'heading',
          'blockquote',
          'codeBlock',
          'tocNode',
        ],
        filterTransaction: (transaction) => !isChangeOrigin(transaction),
      }),
      Typography,
      CharacterCount.configure({ limit: 50000 }),
      TrailingNode,
      UiState,
      TocNode.configure({
        topOffset: 48,
      }),
      ClearMarksOnEnter,
      SearchAndReplace.configure({
        searchResultClass: 'search-result',
        currentSearchResultClass: 'current-search-result',
        disableRegex: true,
        caseSensitive: false,
      }),
      ...(EDITOR_AI_ENABLED ? [createEditorAiExtension(() => getAuthToken())] : []),
    ],
  });

  useEffect(() => {
    onEditorCreate?.(editor ?? null);
  }, [editor, onEditorCreate]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionChange = () => {
      syncSelectAllBlockVisualState(editor);
    };

    editor.on('selectionUpdate', handleSelectionChange);
    editor.on('transaction', handleSelectionChange);
    syncSelectAllBlockVisualState(editor);

    return () => {
      editor.off('selectionUpdate', handleSelectionChange);
      editor.off('transaction', handleSelectionChange);
      (editor.view.dom as HTMLElement).classList.remove(SELECT_ALL_BLOCK_VISUAL_CLASS);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !editable || !documentId) return;
    if (consumedImportForDocRef.current === documentId) return;

    consumedImportForDocRef.current = documentId;
    const pendingFile = consumePendingDocumentImport(documentId);
    if (!pendingFile) return;

    void importDocumentFileToEditor(editor, pendingFile, { source: 'picker' });
  }, [documentId, editable, editor]);

  if (!editor) {
    return <LoadingSpinner />;
  }

  return (
    <div className="notion-like-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        {showHeader && <NotionEditorHeader />}
        <div
          className="notion-like-editor-layout"
          data-page-width={pageWidthMode}
          data-sidebar-open={isDocsSidebarOpen ? 'true' : 'false'}
          suppressHydrationWarning
        >
          <EditorContentArea />
          {showTocSidebar && <TocSidebar topOffset={48} />}
        </div>

        <TableExtendRowColumnButtons />
        <TableHandle />
        <TableSelectionOverlay
          showResizeHandles={true}
          cellMenu={(props) => (
            <TableCellHandleMenu
              editor={props.editor}
              onMouseDown={(e) => props.onResizeStart?.('br')(e)}
            />
          )}
        />
      </EditorContext.Provider>
    </div>
  );
}

/**
 * Full editor with all necessary providers
 */
export function NotionEditor({
  documentId,
  provider,
  ydoc,
  user,
  placeholder = '',
  editable = true,
  showHeader = true,
  showTocSidebar = true,
  onEditorCreate,
}: NotionEditorProps) {
  return (
    <TocProvider>
      <EditorProvider
        documentId={documentId}
        provider={provider}
        ydoc={ydoc}
        user={user}
        placeholder={placeholder}
        editable={editable}
        showHeader={showHeader}
        showTocSidebar={showTocSidebar}
        onEditorCreate={onEditorCreate}
      />
    </TocProvider>
  );
}

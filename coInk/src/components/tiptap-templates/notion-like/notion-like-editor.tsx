'use client';

import { useContext, useEffect } from 'react';
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
} from '@/extensions';
import { CoInkPlaceholder } from '@/extensions/coink-placeholder';
import { useUiEditorState } from '@/hooks/use-ui-editor-state';
import { EDITOR_AI_ENABLED, createEditorAiExtension } from '@/lib/editor-ai';
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils';
import { useEditorStore } from '@/stores/editorStore';
import { useSidebar } from '@/stores/sidebarStore';
import { getAuthToken } from '@/utils';
import { toastError } from '@/utils/toast';
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

export interface NotionEditorProps {
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

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: 'notion-like-editor',
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

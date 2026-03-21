'use client';

import { useContext, useEffect } from 'react';
import { EditorContent, EditorContext, useEditor, type Editor } from '@tiptap/react';
import type { Doc as YDoc } from 'yjs';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createPortal } from 'react-dom';
// --- Tiptap Core Extensions ---
import { StarterKit } from '@tiptap/starter-kit';
import { Mention } from '@tiptap/extension-mention';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder, Selection } from '@tiptap/extensions';
import { Collaboration, isChangeOrigin } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { Mathematics } from '@tiptap/extension-mathematics';
import { UniqueID } from '@tiptap/extension-unique-id';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap/extension-table-of-contents';

// --- Hooks ---
import { useUiEditorState } from '@/hooks/use-ui-editor-state';
import { useScrollToHash } from '@/components/tiptap-ui/copy-anchor-link-button/use-scroll-to-hash';
// --- Custom Extensions ---
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';
import { UiState } from '@/components/tiptap-extension/ui-state-extension';
import { Image } from '@/components/tiptap-node/image-node/image-node-extension';
import { NodeBackground } from '@/components/tiptap-extension/node-background-extension';
import { NodeAlignment } from '@/components/tiptap-extension/node-alignment-extension';
import { TocNode } from '@/components/tiptap-node/toc-node/extensions/toc-node-extension';
// --- Tiptap Node ---
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
// --- Table Node ---
import { TableKit } from '@/components/tiptap-node/table-node/extensions/table-node-extension';
import { TableHandleExtension } from '@/components/tiptap-node/table-node/extensions/table-handle';
import { TableHandle } from '@/components/tiptap-node/table-node/ui/table-handle/table-handle';
import { TableSelectionOverlay } from '@/components/tiptap-node/table-node/ui/table-selection-overlay';
import { TableCellHandleMenu } from '@/components/tiptap-node/table-node/ui/table-cell-handle-menu';
import { TableExtendRowColumnButtons } from '@/components/tiptap-node/table-node/ui/table-extend-row-column-button';
import '@/components/tiptap-node/table-node/styles/prosemirror-table.scss';
import '@/components/tiptap-node/table-node/styles/table-node.scss';
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '@/components/tiptap-node/code-block-node/code-block-node.scss';
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '@/components/tiptap-node/list-node/list-node.scss';
import '@/components/tiptap-node/image-node/image-node.scss';
import '@/components/tiptap-node/heading-node/heading-node.scss';
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss';
// --- Tiptap UI ---
import { EmojiDropdownMenu } from '@/components/tiptap-ui/emoji-dropdown-menu';
import { MentionDropdownMenu } from '@/components/tiptap-ui/mention-dropdown-menu';
import { SlashDropdownMenu } from '@/components/tiptap-ui/slash-dropdown-menu';
import { DragContextMenu } from '@/components/tiptap-ui/drag-context-menu';
import { AiMenu } from '@/components/tiptap-ui/ai-menu';
// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils';
import {
  CharacterCount,
  Chart,
  ClearMarksOnEnter,
  CodeBlock,
  Column,
  Columns,
  Comment,
  Countdown,
  Details,
  DetailsContent,
  DetailsSummary,
  FontFamily,
  FontSize,
  JsonPaste,
  Link as CoInkLink,
  MarkdownPaste,
  MathLiveExtension,
  SearchAndReplace,
  TrailingNode,
  Underline,
  Youtube,
} from '@/extensions';
// --- Styles ---
import '@/components/tiptap-templates/notion-like/notion-like-editor.scss';
// --- Content ---
import { NotionEditorHeader } from '@/components/tiptap-templates/notion-like/notion-like-editor-header';
import { MobileToolbar } from '@/components/tiptap-templates/notion-like/notion-like-editor-mobile-toolbar';
import { NotionToolbarFloating } from '@/components/tiptap-templates/notion-like/notion-like-editor-toolbar-floating';
import { TocSidebar } from '@/components/tiptap-node/toc-node';
import { TocProvider, useToc } from '@/components/tiptap-node/toc-node/context/toc-context';
import { ListNormalizationExtension } from '@/components/tiptap-extension/list-normalization-extension';
export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
}

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

export interface EditorProviderProps {
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
export function EditorProvider(props: EditorProviderProps) {
  const {
    provider,
    ydoc,
    user,
    placeholder = '开始输入...',
    editable = true,
    showHeader = true,
    showTocSidebar = true,
    onEditorCreate,
  } = props;

  const { setTocContent } = useToc();

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
      Placeholder.configure({
        placeholder,
        emptyNodeClass: 'is-empty with-slash',
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
      Image,
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
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error('上传失败:', error),
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
      JsonPaste,
      MarkdownPaste,
      TrailingNode,
      UiState,
      TocNode.configure({
        topOffset: 48,
      }),
      Youtube.configure({
        controls: false,
        nocookie: true,
        inline: false,
        HTMLAttributes: {
          class: 'youtube-video-wrapper',
        },
      }),
      ClearMarksOnEnter,
      Chart,
      Countdown,
      Comment.configure({
        HTMLAttributes: {
          class: 'comment',
        },
        onCommentActivated: () => {},
        onCommentClick: () => {},
      }),
      SearchAndReplace.configure({
        searchResultClass: 'search-result',
        currentSearchResultClass: 'current-search-result',
        disableRegex: true,
        caseSensitive: false,
      }),
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
        <div className="notion-like-editor-layout">
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
  placeholder = '开始输入...',
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

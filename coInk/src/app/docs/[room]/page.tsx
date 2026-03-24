'use client';

import { useCallback, useEffect, useState, useRef, Activity } from 'react';
import { useParams } from 'next/navigation';
import type { Editor } from '@tiptap/react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Group, Panel, type GroupImperativeHandle } from 'react-resizable-panels';
import 'md-editor-rt/lib/preview.css';

// 动态导入 CommentPanel，禁用 SSR
const CommentPanel = dynamic(
  () =>
    import('@/app/docs/_components/CommentPanel').then((mod) => ({ default: mod.CommentPanel })),
  {
    ssr: false,
    loading: () => null,
  },
);

import { getCursorColorByUserId, getAuthToken } from '@/utils';
import { getSelectionLineRange } from '@/utils/editor';
import DocumentHeader from '@/app/docs/_components/DocumentHeader';
import { SearchPanel } from '@/app/docs/_components/SearchPanel';
import { useFileStore } from '@/stores/fileStore';
import type { FileItem } from '@/types/file-system';
import { NotionEditor } from '@/components/tiptap-templates/notion-like/notion-like-editor';
import { documentsApi } from '@/services/documents';
import NoPermission from '@/app/docs/_components/NoPermission';
import type { PermissionLevel } from '@/services/documents/types';
import { useCommentStore } from '@/stores/commentStore';
import { useEditorStore } from '@/stores/editorStore';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { useSidebar } from '@/stores/sidebarStore';

// 类型定义
interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar: string;
  isAnonymous?: boolean;
}

interface DocumentPermissionData {
  documentId: string;
  userId: string;
  username: string;
  avatar: string;
  documentTitle: string;
  documentType: 'FILE' | 'FOLDER';
  isOwner: boolean;
  permission: PermissionLevel;
}

export default function DocumentPage() {
  const params = useParams();
  const documentId = params?.room as string;
  const groupRef = useRef<GroupImperativeHandle>(null);
  const collabSyncedRef = useRef(false);
  const cloudSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** onSynced 后短窗口内忽略 Yjs update，减少 IDB 合并/初始同步误触发「正在保存」 */
  const ignoreCloudSaveHintsUntilRef = useRef(0);

  const { documentGroups, patchDocumentUpdatedAt } = useFileStore();
  const { isOpen: isSidebarOpen, toggle: toggleSidebar } = useSidebar();

  // 防止水合不匹配的强制客户端渲染
  const [isMounted, setIsMounted] = useState(false);

  // 权限相关状态
  const [permissionData, setPermissionData] = useState<DocumentPermissionData | null>(null);
  const [isLoadingPermission, setIsLoadingPermission] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // 协作编辑器状态
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>([]);
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  /** Hocuspocus 落库成功后 stateless 推送的 updatedAt（ISO） */
  const [cloudSavedUpdatedAt, setCloudSavedUpdatedAt] = useState<string | null>(null);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const { closePanel, isPanelOpen } = useCommentStore();
  const { setEditor, clearEditor } = useEditorStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEditorHistory({
    documentId,
    doc,
    autoSnapshot: true,
    autoSnapshotInterval: 300000,
    snapshotOnUnmount: true,
  });

  // Editor编辑器的容器元素
  const editorContainRef = useRef<HTMLDivElement>(null);

  // 递归查找文件的函数，支持嵌套文件夹
  const findFileById = (items: FileItem[], id: string): FileItem | null => {
    for (const item of items) {
      if (item.id === id) return item;

      if (item.children && item.children.length > 0) {
        const found = findFileById(item.children, id);
        if (found) return found;
      }
    }

    return null;
  };

  // 获取当前文档的名称
  const getCurrentDocumentName = () => {
    if (!documentId || documentGroups.length === 0) return null;

    // 在所有分组中查找
    for (const group of documentGroups) {
      const currentFile = findFileById(group.files, documentId);

      if (currentFile) {
        return currentFile.name;
      }
    }

    return null;
  };

  // 计算当前文档名称（用于传递给子组件）
  const currentDocumentName = getCurrentDocumentName();

  // 获取权限并初始化
  useEffect(() => {
    if (!documentId || typeof window === 'undefined') return;

    // 切换文档时先重置协作初始化门槛，避免 IndexedDB 未就绪时提前创建编辑器/连接
    setIsIndexedDBReady(false);
    setProvider(null);
    setConnectedUsers([]);
    setConnectionStatus('disconnected');
    collabSyncedRef.current = false;
    ignoreCloudSaveHintsUntilRef.current = 0;
    setCloudSavedUpdatedAt(null);
    setIsCloudSaving(false);

    async function init() {
      setIsLoadingPermission(true);
      setPermissionError(null);

      // 从 localStorage 获取当前用户ID
      let userId = '';
      try {
        const cachedUser = localStorage.getItem('cached_user_profile');
        if (cachedUser) {
          const user = JSON.parse(cachedUser) as { userId?: string };
          userId = user.userId || '';
        }
      } catch {
        // 解析失败时 userId 保持为空字符串
      }

      const { data, error } = await documentsApi.getCurrentPermission(documentId, { userId });

      if (error) {
        setPermissionError(error);
        setIsLoadingPermission(false);

        return;
      }

      if (!data?.data) {
        setPermissionError('无法获取文档权限信息');
        setIsLoadingPermission(false);

        return;
      }

      // 从 localStorage 获取当前用户信息
      let name = '';
      let avatarUrl = '';
      try {
        const cachedUser = localStorage.getItem('cached_user_profile');
        if (cachedUser) {
          const user = JSON.parse(cachedUser) as {
            userId?: string;
            name?: string;
            avatarUrl?: string;
          };
          userId = user.userId || '';
          name = user.name || '';
          avatarUrl = user.avatarUrl || '';
        }
      } catch {
        // 解析失败时保持空字符串
      }

      const rawPerm = data.data.permission;
      let docTitle = '';
      let documentType: 'FILE' | 'FOLDER' = 'FILE';
      if (!rawPerm || rawPerm === '') {
        const docRes = await documentsApi.getById(documentId);
        const meta = docRes?.data?.data;
        if (meta) {
          docTitle = meta.title ?? '';
          documentType = meta.type === 'FOLDER' ? 'FOLDER' : 'FILE';
        }
      }

      // Map the response to the expected format
      const permData: DocumentPermissionData = {
        documentId,
        userId,
        username: name,
        avatar: avatarUrl,
        documentTitle: docTitle,
        documentType,
        isOwner: false,
        permission: (rawPerm ?? '') as PermissionLevel,
      };
      setPermissionData(permData);
      setIsLoadingPermission(false);

      if (userId && rawPerm && rawPerm !== '' && permData.documentType === 'FILE') {
        void documentsApi.recordAccess(documentId, { userId });
      }

      // 无权限时不初始化编辑器 (没有 'view' 权限表示无权限)
      if (!rawPerm || rawPerm === '') {
        setIsMounted(true);

        return;
      }

      // 初始化编辑器和用户信息（匿名访客使用灰色访客身份）
      const isAnonymous = !userId;
      const displayName = name || (isAnonymous ? '匿名访客' : '用户');
      const runtimeUserId = isAnonymous
        ? `guest_${Math.random().toString(36).slice(2, 10)}`
        : userId;

      setDoc(new Y.Doc());
      setCurrentUser({
        id: runtimeUserId,
        name: displayName,
        color: isAnonymous ? '#9ca3af' : getCursorColorByUserId(userId),
        avatar: avatarUrl,
        isAnonymous,
      });
      setIsMounted(true);
    }

    init();
  }, [documentId]);

  // 本地持久化
  useEffect(() => {
    if (!documentId || !doc || typeof window === 'undefined' || !permissionData) return;

    setIsIndexedDBReady(false);

    const persistence = new IndexeddbPersistence(`tiptap-collaborative-${documentId}`, doc);

    // 等待 IndexedDB 加载完成
    persistence.on('synced', () => {
      setIsIndexedDBReady(true);
    });

    return () => {
      persistence.destroy();
    };
  }, [documentId, doc, permissionData]);

  // 协作提供者
  useEffect(() => {
    if (!documentId || !doc || !permissionData || !isIndexedDBReady) return;

    const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

    if (!websocketUrl) {
      return;
    }

    const authToken = getAuthToken();
    setConnectionStatus('connecting');
    const hocuspocusProvider = new HocuspocusProvider({
      url: websocketUrl,
      name: documentId,
      document: doc,
      token: authToken,

      onConnect: () => {
        console.log('WebSocket连接建立');
        setConnectionStatus('connecting');
      },

      onAuthenticated: () => {
        console.log('身份验证成功');
        setConnectionStatus('connected');
      },

      onAuthenticationFailed: () => {
        setConnectionStatus('error');
      },

      onSynced: ({ state }) => {
        console.log('文档同步完成', state);
        setConnectionStatus('connected');
        collabSyncedRef.current = true;
        ignoreCloudSaveHintsUntilRef.current = Date.now() + 1500;
      },

      onDisconnect: () => {
        setConnectionStatus('disconnected');
        collabSyncedRef.current = false;
      },

      onClose: () => {
        setConnectionStatus('disconnected');
        collabSyncedRef.current = false;
      },

      onStateless: ({ payload }) => {
        try {
          const data = JSON.parse(payload) as {
            type?: string;
            documentId?: string;
            updatedAt?: string;
          };
          if (data.type !== 'coink:document-saved' || data.documentId !== documentId) {
            return;
          }
          if (data.updatedAt) {
            patchDocumentUpdatedAt(documentId, data.updatedAt);
            setCloudSavedUpdatedAt(data.updatedAt);
          }
          setIsCloudSaving(false);
          if (cloudSaveSafetyRef.current) {
            clearTimeout(cloudSaveSafetyRef.current);
            cloudSaveSafetyRef.current = null;
          }
        } catch {
          // 非 JSON 或其它 stateless 消息忽略
        }
      },
    });

    setProvider(hocuspocusProvider);

    return () => {
      if (cloudSaveDebounceRef.current) {
        clearTimeout(cloudSaveDebounceRef.current);
        cloudSaveDebounceRef.current = null;
      }
      if (cloudSaveSafetyRef.current) {
        clearTimeout(cloudSaveSafetyRef.current);
        cloudSaveSafetyRef.current = null;
      }
      hocuspocusProvider.destroy();
    };
  }, [documentId, doc, permissionData, isIndexedDBReady, patchDocumentUpdatedAt, currentUser]);

  // 设置用户awareness信息
  useEffect(() => {
    if (provider?.awareness && currentUser) {
      provider.awareness.setLocalStateField('user', currentUser);
    }
  }, [provider, currentUser]);

  // 协作用户管理
  useEffect(() => {
    if (!provider?.awareness || !currentUser?.id) return;

    const handleAwarenessUpdate = () => {
      const states = provider.awareness!.getStates();
      const userMap = new Map<string, CollaborationUser>();

      states.forEach((state, clientId) => {
        if (state?.user) {
          const userData = state.user as Partial<CollaborationUser>;
          const userId = userData.id || clientId.toString();

          // 只添加其他用户，排除当前用户，并按 userId 去重
          if (userId && userId !== currentUser.id && !userMap.has(userId)) {
            userMap.set(userId, {
              id: userId,
              name: userData.name || '未知用户',
              color: userData.color || getCursorColorByUserId(userId),
              avatar: userData.avatar || '',
            });
          }
        }
      });

      setConnectedUsers(Array.from(userMap.values()));
    };

    provider.awareness.on('update', handleAwarenessUpdate);
    // 初始调用一次，确保状态正确
    handleAwarenessUpdate();

    return () => provider.awareness?.off('update', handleAwarenessUpdate);
  }, [provider, currentUser]);

  // 判断是否为只读模式（匿名访客恒只读）
  const isReadOnly = Boolean(currentUser?.isAnonymous) || permissionData?.permission === 'view';

  const CLOUD_SAVE_DEBOUNCE_MS = 400;
  const CLOUD_SAVE_SAFETY_MS = 20_000;

  // 本地编辑（非远端 Yjs 同步）→ 防抖后显示「正在保存」，直至收到服务端 stateless 落库确认
  useEffect(() => {
    if (!doc || !provider || isReadOnly) return;

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (!collabSyncedRef.current) return;
      if (Date.now() < ignoreCloudSaveHintsUntilRef.current) return;
      if (origin === provider) return;

      if (cloudSaveDebounceRef.current) {
        clearTimeout(cloudSaveDebounceRef.current);
      }
      cloudSaveDebounceRef.current = setTimeout(() => {
        cloudSaveDebounceRef.current = null;
        setIsCloudSaving(true);
        if (cloudSaveSafetyRef.current) {
          clearTimeout(cloudSaveSafetyRef.current);
        }
        cloudSaveSafetyRef.current = setTimeout(() => {
          cloudSaveSafetyRef.current = null;
          setIsCloudSaving(false);
        }, CLOUD_SAVE_SAFETY_MS);
      }, CLOUD_SAVE_DEBOUNCE_MS);
    };

    doc.on('update', handleDocUpdate);

    return () => {
      doc.off('update', handleDocUpdate);
      if (cloudSaveDebounceRef.current) {
        clearTimeout(cloudSaveDebounceRef.current);
        cloudSaveDebounceRef.current = null;
      }
      if (cloudSaveSafetyRef.current) {
        clearTimeout(cloudSaveSafetyRef.current);
        cloudSaveSafetyRef.current = null;
      }
    };
  }, [doc, provider, isReadOnly]);

  // 搜索快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F 打开搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // ESC 关闭搜索
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const [editor, setEditorInstance] = useState<Editor | null>(null);

  const handleEditorCreate = useCallback(
    (nextEditor: Editor | null) => {
      setEditorInstance(nextEditor);

      if (nextEditor && documentId) {
        setEditor(nextEditor, documentId);
      } else {
        clearEditor();
      }
    },
    [documentId, setEditor, clearEditor],
  );

  // 点击编辑器内容时关闭评论面板（除非点击评论标记）
  useEffect(() => {
    if (!editor || !isPanelOpen) return;

    const handleEditorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isCommentMark = target.closest('span[data-comment="true"]');

      // 如果点击的不是评论标记，则关闭面板
      if (!isCommentMark) {
        closePanel();
      }
    };

    const editorElement = editor.view.dom;

    // 确保元素仍然存在于DOM中
    if (editorElement && document.body.contains(editorElement)) {
      editorElement.addEventListener('click', handleEditorClick);

      return () => {
        // 再次检查元素是否仍然存在于DOM中
        if (editorElement && document.body.contains(editorElement)) {
          editorElement.removeEventListener('click', handleEditorClick);
        }
      };
    }
  }, [editor, isPanelOpen, closePanel]);

  // 编辑器内复制：写入 text/html + text/plain（与 ProseMirror 序列化一致），避免只写纯文本导致粘贴丢失格式
  // 不再写入 text/json 整篇文档，否则会触发 JsonPaste 覆盖整篇内容
  useEffect(() => {
    if (!editor) return;

    const dom = editor.view.dom;

    const handleCopy = (e: ClipboardEvent) => {
      const { state } = editor;
      const { selection } = state;

      if (selection.empty || !e.clipboardData) return;

      try {
        const slice = selection.content();
        const { dom: htmlWrap, text } = editor.view.serializeForClipboard(slice);
        const selectedText = state.doc.textBetween(selection.from, selection.to, '\n');

        e.clipboardData.setData('text/html', htmlWrap.innerHTML);
        e.clipboardData.setData('text/plain', text || selectedText);

        const { startLine, endLine } = getSelectionLineRange(
          state.doc,
          selection.from,
          selection.to,
        );
        const documentName = getCurrentDocumentName() || '未命名文档';
        const referenceData = {
          type: 'docflow-reference',
          fileName: documentName,
          startLine: Math.max(1, startLine - 1),
          endLine: Math.max(1, endLine - 1),
          content: selectedText,
          charCount: selectedText.length,
        };
        e.clipboardData.setData('application/docflow-reference', JSON.stringify(referenceData));

        e.preventDefault();
      } catch (error) {
        console.error('复制失败:', error);
      }
    };

    dom.addEventListener('copy', handleCopy);

    return () => dom.removeEventListener('copy', handleCopy);
  }, [editor]);

  // 组件卸载时清理编辑器实例
  useEffect(() => {
    return () => {
      clearEditor();
    };
  }, [clearEditor]);

  // 可复用的加载状态组件
  const LoadingState = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div
      className="h-screen flex items-center justify-center bg-white dark:bg-gray-900"
      suppressHydrationWarning
    >
      <div className="text-center">
        <div className="inline-block animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-lg text-gray-600 dark:text-gray-400">{title}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2" suppressHydrationWarning>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  // 权限加载中
  if (isLoadingPermission) {
    return <LoadingState title="正在加载文档权限..." />;
  }

  // 权限错误或无权限访问
  if (permissionError || !permissionData?.permission) {
    return (
      <NoPermission
        documentId={documentId}
        documentTitle={permissionData?.documentTitle}
        message={
          permissionError ||
          '您当前没有访问此文档的权限。若该文档曾出现在共享列表中，可能是所有者已收回或变更了权限。'
        }
      />
    );
  }

  // 编辑器初始化中
  if (
    !isMounted ||
    !doc ||
    !currentUser ||
    !isIndexedDBReady ||
    (!provider && !currentUser.isAnonymous)
  ) {
    const getSubtitle = () => {
      if (!isMounted) return '等待挂载...';
      if (!doc) return '创建文档...';
      if (!currentUser) return '加载用户信息...';
      if (!isIndexedDBReady) return '加载数据...';
      if (!provider && !currentUser.isAnonymous) return '连接协作服务...';

      return '';
    };

    return <LoadingState title="正在初始化编辑器..." subtitle={getSubtitle()} />;
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900" suppressHydrationWarning>
      {/* 只读模式提示条 - 使用 Activity 优化显示/隐藏性能 */}
      <Activity mode={isReadOnly ? 'visible' : 'hidden'}>
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 dark:text-amber-200">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">
            {currentUser?.isAnonymous
              ? '匿名访问 - 当前为只读模式'
              : '只读模式 - 您只能查看此文档，无法编辑'}
          </span>
        </div>
      </Activity>

      {/* Header */}
      <DocumentHeader
        provider={provider}
        connectedUsers={connectedUsers}
        currentUser={currentUser}
        documentId={documentId}
        documentTitle={currentDocumentName ?? undefined}
        documentName={currentDocumentName ?? `文档 ${documentId}`}
        doc={doc}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        connectionStatus={connectionStatus}
        cloudSavedUpdatedAt={cloudSavedUpdatedAt}
        isCloudSaving={isCloudSaving}
      />

      {/* 主内容区域 - 使用可调整大小的面板布局 */}
      <div className="flex flex-1 overflow-hidden">
        <Group orientation="horizontal" className="flex-1" groupRef={groupRef}>
          {/* 编辑器面板 */}
          <Panel id="editor" defaultSize="65" minSize="30">
            <div className="h-full relative overflow-hidden">
              <div
                ref={editorContainRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden relative"
              >
                {doc && currentUser && provider && (
                  <NotionEditor
                    provider={provider}
                    ydoc={doc}
                    user={currentUser}
                    editable={!isReadOnly}
                    showHeader={false}
                    showTocSidebar
                    onEditorCreate={handleEditorCreate}
                  />
                )}
              </div>
            </div>
          </Panel>
        </Group>
      </div>
      {/* 评论面板 */}
      {editor && (
        <Activity>
          <CommentPanel editor={editor} documentId={documentId} currentUserId={currentUser?.id} />
        </Activity>
      )}

      {/* 搜索面板 */}
      {editor && editor.view && (
        <SearchPanel editor={editor} isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      )}
    </div>
  );
}

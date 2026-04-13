'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Info, Loader2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { SnapshotReadonlyPane } from './snapshot-readonly-pane';

import { toastSuccess, toastError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { documentsApi } from '@/services/documents';
import { documentVersionApi } from '@/services/documents/versions';
import type { DocumentVersion } from '@/services/documents/types';
import { cn, getCurrentUserId } from '@/utils';

function unwrapVersions(payload: unknown): DocumentVersion[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as DocumentVersion[];
  if (typeof payload === 'object' && payload !== null && 'versions' in payload) {
    return (payload as { versions?: DocumentVersion[] }).versions ?? [];
  }
  return [];
}

function SnapshotHistoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = params?.room as string;

  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const vParam = searchParams.get('v');

  const loadAll = useCallback(async () => {
    if (!documentId) return;
    setLoadingList(true);
    try {
      const [docRes, verRes] = await Promise.all([
        documentsApi.getById(documentId),
        documentVersionApi.getVersions(documentId),
      ]);
      if (docRes.data?.data?.title) {
        setDocumentTitle(docRes.data.data.title);
      }
      if (verRes.error) {
        toastError('加载版本列表失败');
        setVersions([]);
      } else {
        setVersions(unwrapVersions(verRes.data?.data));
      }
    } catch (e) {
      console.error(e);
      toastError('加载失败');
    } finally {
      setLoadingList(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handlePickVersion = useCallback(
    (versionId: string) => {
      if (!documentId) return;
      router.replace(`/docs/${documentId}/snapshot?v=${encodeURIComponent(versionId)}`, {
        scroll: false,
      });
    },
    [documentId, router],
  );

  useEffect(() => {
    if (!vParam || !documentId) {
      setSelectedVersion(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void documentVersionApi.getVersionById(documentId, vParam).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.data) {
        setSelectedVersion(null);
        toastError('加载版本详情失败');
      } else {
        setSelectedVersion(data.data);
      }
      setLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vParam, documentId]);

  const grouped = useMemo(() => {
    const map = new Map<string, DocumentVersion[]>();
    for (const v of versions) {
      let day = '其他';
      try {
        day = format(new Date(v.createdAt), 'yyyy-MM-dd', { locale: zhCN });
      } catch {
        /* ignore */
      }
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(v);
    }
    return map;
  }, [versions]);

  const handleRestore = async () => {
    if (!documentId || !selectedVersion) return;
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    if (
      !confirm(
        `确定将文档还原为此版本吗？\n「${selectedVersion.title}」\n当前内容将被覆盖，协作者也会同步到新内容。`,
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      const { error } = await documentVersionApi.restoreVersion(
        documentId,
        selectedVersion.versionId,
      );
      if (error) {
        toastError('还原失败');
        return;
      }
      toastSuccess('已还原，正在进入文档…');
      window.location.assign(`/docs/${documentId}`);
    } catch (e) {
      console.error(e);
      toastError('还原失败');
    } finally {
      setRestoring(false);
    }
  };

  if (!documentId) {
    return null;
  }

  const snapshotJson = selectedVersion?.content as Record<string, unknown> | undefined;

  return (
    <div className="flex h-[100dvh] flex-col bg-white dark:bg-gray-950">
      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => router.push(`/docs/${documentId}`)}
              aria-label="返回文档"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                历史记录
              </h1>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {documentTitle || documentId}
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!selectedVersion || restoring}
            onClick={handleRestore}
            className="shrink-0 gap-1.5 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {restoring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            还原此历史记录
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="notion-like-editor flex min-w-0 flex-1 flex-col overflow-hidden p-4">
          {loadingList ? (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : loadingDetail && vParam ? (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !selectedVersion ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-400">
              在右侧选择一个历史版本，以只读方式查看当时保存的正文与样式
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/40">
              <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">只读预览</span>
                <span className="ml-1.5">
                  与编辑页同一套扩展与样式，展示该版本保存时的完整内容。
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <SnapshotReadonlyPane key={selectedVersion.versionId} content={snapshotJson} />
              </div>
            </div>
          )}
        </main>

        <aside className="flex w-full max-w-[min(100%,20rem)] flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30">
          <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50/95 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/90">
            <Info className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              历史记录
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {versions.length === 0 && !loadingList && (
              <p className="p-4 text-center text-sm text-gray-400">暂无保存的版本</p>
            )}
            <ul className="p-2">
              {Array.from(grouped.entries()).map(([day, items]) => (
                <li key={day} className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-medium text-gray-400">{day}</div>
                  <ul className="space-y-0.5">
                    {items.map((v) => {
                      const active = vParam === v.versionId;
                      return (
                        <li key={v.versionId}>
                          <button
                            type="button"
                            onClick={() => handlePickVersion(v.versionId)}
                            className={cn(
                              'w-full rounded-lg border-l-4 py-2 pl-2 pr-3 text-left text-sm transition-colors',
                              active
                                ? 'border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
                                : 'border-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20',
                            )}
                          >
                            <div className="text-[11px] text-gray-400">
                              {format(new Date(v.createdAt), 'M月d日 HH:mm', { locale: zhCN })}
                            </div>
                            <div className="truncate font-medium text-gray-800 dark:text-gray-100">
                              {v.title}
                            </div>
                            {v.description ? (
                              <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                                {v.description}
                              </div>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function SnapshotHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white dark:bg-gray-950">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <SnapshotHistoryPageContent />
    </Suspense>
  );
}

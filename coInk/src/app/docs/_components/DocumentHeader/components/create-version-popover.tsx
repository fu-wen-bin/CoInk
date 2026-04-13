'use client';

import { useState, type ChangeEvent } from 'react';
import { Layers } from 'lucide-react';
import { encodeStateAsUpdate, type Doc } from 'yjs';

import { toastSuccess, toastError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Textarea from '@/components/ui/Textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { documentVersionApi } from '@/services/documents/versions';
import { useEditorStore } from '@/stores/editorStore';
import { cn, getCurrentUserId } from '@/utils';

/** 与 document-actions 下拉菜单容器一致的窄浮层样式 */
const popoverSurfaceClass = cn(
  'flex w-[min(22rem,92vw)] flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-3 shadow',
  'dark:border-gray-700 dark:bg-gray-800',
  'z-[9999]',
);

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

interface CreateVersionPopoverProps {
  documentId: string;
  documentTitle: string;
  doc: Doc | null;
}

export function CreateVersionPopover({
  documentId,
  documentTitle,
  doc,
}: CreateVersionPopoverProps) {
  const editor = useEditorStore((s) => s.editor);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const defaultTitle = `${documentTitle || '未命名文档'}`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTitle(defaultTitle);
      setDescription('');
    }
  };

  const handleSubmit = async () => {
    if (!editor || !doc) {
      toastError('编辑器未就绪，无法创建版本');
      return;
    }
    const uid = getCurrentUserId();
    if (!uid) {
      toastError('请先登录');
      return;
    }
    const finalTitle = title.trim() || defaultTitle;
    setSubmitting(true);
    try {
      const content = editor.getJSON() as Record<string, unknown>;
      const update = encodeStateAsUpdate(doc);
      const yStateBase64 = uint8ToBase64(update);
      const { error } = await documentVersionApi.createVersion(documentId, {
        documentId,
        title: finalTitle,
        description: description.trim() || undefined,
        content,
        yStateBase64,
        userId: uid,
      });
      if (error) {
        toastError(typeof error === 'string' ? error : '创建版本失败');
        return;
      }
      toastSuccess('已保存版本快照');
      setOpen(false);
    } catch (e) {
      console.error(e);
      toastError('创建版本失败');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !editor || !doc;

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'p-2 rounded-lg transition-colors',
            disabled
              ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
          title="创建版本（快照）"
          aria-label="创建版本（快照）"
        >
          <Layers className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className={popoverSurfaceClass}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">创建版本</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            将当前内容与协同状态保存为历史版本，可在「历史记录」中对比与还原。
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="version-title" className="text-xs">
            文档标题
          </Label>
          <Input
            id="version-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={defaultTitle}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="version-desc" className="text-xs">
            描述（可选）
          </Label>
          <Textarea
            id="version-desc"
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="简要说明此版本…"
            rows={3}
            className="resize-none text-sm min-h-[72px]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" size="sm" disabled={submitting || disabled} onClick={handleSubmit}>
            {submitting ? '保存中…' : '保存版本'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

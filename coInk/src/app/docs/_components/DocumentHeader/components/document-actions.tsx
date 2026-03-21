'use client';

import { useState } from 'react';
import { FileType, MoreHorizontal } from 'lucide-react';
import juice from 'juice';
import { toast } from 'sonner';

import ShareDialog from '../../DocumentSidebar/folder/ShareDialog';
import HistoryPanel from '../../HistoryPanel';
import type { DocumentActionsProps, ExportAction } from '../types';

import type { FileItem } from '@/types/file-system';
import { useCommentStore } from '@/stores/commentStore';
import {
  cleanElementAttributes,
  extraCss,
  processImages,
  processLinks,
  handleExportPDF,
  handleExportDOCX,
} from '@/utils';
import {
  Menu as PopoverMenu,
  Item as PopoverItem,
  CategoryTitle as PopoverCategoryTitle,
} from '@/components/ui/PopoverMenu';

export function DocumentActions({
  editor,
  documentId,
  documentTitle,
  doc,
  connectedUsers,
  currentUser,
}: DocumentActionsProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogFile, setShareDialogFile] = useState<FileItem | null>(null);

  const { isPanelOpen, togglePanel, comments } = useCommentStore();

  // 处理分享按钮点击
  const handleShare = () => {
    if (documentId) {
      const fileItem: FileItem = {
        id: documentId,
        name: documentTitle,
        type: 'file',
        depth: 0,
      };
      setShareDialogFile(fileItem);
      setShareDialogOpen(true);
    }
  };

  // 处理复制按钮点击
  const handleCopy = async () => {
    try {
      const htmlContent = editor.getHTML();

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      cleanElementAttributes(tempDiv);
      processImages(tempDiv);
      processLinks(tempDiv);

      const unsupportedElements = tempDiv.querySelectorAll(
        'script, style, iframe, object, embed, video, audio, canvas, svg, noscript',
      );
      unsupportedElements.forEach((el) => el.remove());

      const processedHTML = tempDiv.innerHTML;

      const inlinedHTML = juice(processedHTML, {
        removeStyleTags: true,
        preserveImportant: true,
        applyWidthAttributes: true,
        applyHeightAttributes: true,
        applyAttributesTableElements: true,
        extraCss: extraCss,
      });

      const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${inlinedHTML}</body></html>`;
      const textContent = tempDiv.innerText || tempDiv.textContent || '';

      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([fullHTML], { type: 'text/html' }),
        'text/plain': new Blob([textContent], { type: 'text/plain' }),
      });

      await navigator.clipboard.write([clipboardItem]);
      toast.success('文档已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      toast.error('复制失败');
    }
  };

  const handleSelectAction = (value: ExportAction) => {
    switch (value) {
      case 'copy':
        handleCopy();
        break;
      case 'pdf':
        handleExportPDF(documentTitle);
        break;
      case 'docx':
        handleExportDOCX(documentTitle, editor);
        break;
    }
  };

  return (
    <>
      <PopoverMenu
        trigger={
          <button
            type="button"
            className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        }
        customTrigger
      >
        <PopoverCategoryTitle>协作与分享</PopoverCategoryTitle>
        <PopoverItem
          label={
            <div className="flex w-full items-center justify-between">
              <span>{isPanelOpen ? '关闭评论' : '打开评论'}</span>
              {comments.length > 0 && (
                <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {comments.length}
                </span>
              )}
            </div>
          }
          icon="MessageSquare"
          onClick={togglePanel}
        />
        {documentId && <PopoverItem label="分享" icon="Share" onClick={handleShare} />}

        <PopoverCategoryTitle>文档操作</PopoverCategoryTitle>
        {documentId && doc && (
          <HistoryPanel
            documentId={documentId}
            doc={doc}
            connectedUsers={connectedUsers}
            currentUser={currentUser}
          />
        )}
        <PopoverItem label="复制到公众号" icon="Copy" onClick={() => handleSelectAction('copy')} />
        <PopoverItem
          label="导出PDF"
          iconComponent={<FileType className="w-4 h-4" />}
          onClick={() => handleSelectAction('pdf')}
        />
        <PopoverItem label="导出Word" icon="FileText" onClick={() => handleSelectAction('docx')} />
      </PopoverMenu>

      {/* 分享对话框 */}
      {shareDialogFile && (
        <ShareDialog
          file={shareDialogFile}
          isOpen={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setShareDialogFile(null);
          }}
        />
      )}
    </>
  );
}

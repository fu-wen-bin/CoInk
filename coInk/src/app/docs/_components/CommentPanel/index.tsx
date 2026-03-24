'use client';

import { toastSuccess, toastError, toastInfo } from '@/utils/toast';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Plus } from 'lucide-react';
import type { Editor } from '@tiptap/react';

import { CommentThread } from './comment-thread';

import { Button } from '@/components/ui/button';
import Textarea from '@/components/ui/Textarea';
import { useCommentStore } from '@/stores/commentStore';
import CommentApi from '@/services/comment';
import { getAllComments } from '@/extensions/Comment';

interface CommentPanelProps {
  editor: Editor | null;
  documentId: string;
  currentUserId?: string;
}

export function CommentPanel({ editor, documentId, currentUserId }: CommentPanelProps) {
  const {
    isPanelOpen,
    closePanel,
    comments,
    setComments,
    activeCommentId,
    setActiveCommentId,
    hoveredCommentId,
    setHoveredCommentId,
    deleteComment: deleteCommentFromStore,
    updateComment,
    addComment,
    isCreatingNewComment,
    setIsCreatingNewComment,
  } = useCommentStore();

  const [newCommentContent, setNewCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // 确保组件在客户端挂载后才渲染
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 当进入创建新评论模式时，获取当前选中的文本
  useEffect(() => {
    if (isCreatingNewComment && editor) {
      const { selection } = editor.state;

      if (!selection.empty) {
        const text = editor.state.doc.textBetween(selection.from, selection.to);
        setSelectedText(text);
      }
    } else {
      setSelectedText('');
    }
  }, [isCreatingNewComment, editor]);

  // 加载评论数据
  useEffect(() => {
    const loadComments = async () => {
      if (!isPanelOpen || !documentId) return;

      try {
        const data = await CommentApi.getComments(documentId);
        setComments(data);

        // 清理孤立的评论标记（没有对应评论的标记）
        if (editor && data) {
          const validCommentIds = new Set(data.map((c) => c.commentId));
          const allCommentMarks = getAllComments(editor);

          console.log('🧹 检查孤立的评论标记');
          console.log('📋 有效的评论 ID:', Array.from(validCommentIds));
          console.log(
            '📝 编辑器中的评论标记:',
            allCommentMarks.map((m) => m.commentId),
          );

          // 找出孤立的标记
          const orphanedMarks = allCommentMarks.filter(
            (mark) => !validCommentIds.has(mark.commentId),
          );

          if (orphanedMarks.length > 0) {
            console.warn('⚠️ 发现孤立的评论标记:', orphanedMarks);

            // 移除孤立的标记
            orphanedMarks.forEach((mark) => {
              console.log('🗑️ 移除孤立标记:', mark.commentId);
              editor.chain().focus().unsetComment(mark.commentId).run();
            });

            toastInfo(`已清理 ${orphanedMarks.length} 个孤立的评论标记`);
          }
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
        toastError('加载评论失败');
      }
    };

    loadComments();
  }, [isPanelOpen, documentId, setComments, editor]);

  // 创建新评论
  const handleCreateComment = async () => {
    if (!editor || !newCommentContent.trim()) {
      toastError('请输入评论内容');

      return;
    }

    const { selection } = editor.state;

    if (selection.empty) {
      toastError('请先选择要评论的文本');

      return;
    }

    setIsSubmitting(true);

    try {
      const { from, to } = selection;
      const text = editor.state.doc.textBetween(from, to);

      // 先创建评论（不添加标记）
      // 生成新的 commentId
      const newCommentId = crypto.randomUUID();

      // 创建评论数据（使用 mark_id，不再需要 from/to）
      const newThread = await CommentApi.createComment({
        documentId,
        commentId: newCommentId, // mark_id
        text,
        content: newCommentContent.trim(),
      });

      // ✅ 评论创建成功后，再添加编辑器标记
      // 重新选中文本范围
      editor.chain().focus().setTextSelection({ from, to }).run();

      // 添加标记，使用刚创建的 commentId
      const result = editor.chain().setComment(newCommentId).run();

      if (!result) {
        console.warn('添加评论标记失败，但评论已创建');
      }

      addComment(newThread);
      setNewCommentContent('');
      setIsCreatingNewComment(false);
      toastSuccess('评论创建成功');
    } catch (error) {
      console.error('Failed to create comment:', error);
      toastError('创建评论失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 解决评论
  const handleResolveComment = async (threadId: string) => {
    try {
      await CommentApi.updateComment({ id: threadId, resolved: true });
      updateComment(threadId, { resolved: true });
      toastSuccess('评论已标记为解决');
    } catch (error) {
      console.error('Failed to resolve comment:', error);
      toastError('操作失败，请重试');
    }
  };

  // 删除评论
  const handleDeleteComment = async (thread: any) => {
    try {
      console.log('🗑️ 删除评论，commentId:', thread.commentId);

      // 从编辑器中移除标记
      if (editor) {
        const result = editor.chain().focus().unsetComment(thread.commentId).run();
        console.log('📝 移除编辑器标记结果:', result);

        // 强制更新编辑器视图
        editor.view.updateState(editor.state);
      }

      // 从服务器删除
      await CommentApi.deleteComment({ id: thread.id });

      // 从本地状态删除
      deleteCommentFromStore(thread.id);

      toastSuccess('评论已删除');
      console.log('✅ 评论删除完成');
    } catch (error) {
      console.error('❌ 删除失败:', error);
      toastError('删除失败，请重试');
    }
  };

  // 处理线程悬停 - 高亮编辑器中的文本
  const handleThreadHover = (commentId: string) => {
    setHoveredCommentId(commentId);

    // 高亮编辑器中的评论标记
    if (editor && typeof document !== 'undefined') {
      const commentSpans = document.querySelectorAll(`span[data-comment-id="${commentId}"]`);
      commentSpans.forEach((span) => {
        span.classList.add('comment-hovered');
      });
    }
  };

  const handleThreadLeave = () => {
    setHoveredCommentId(null);

    // 移除所有悬停高亮
    if (typeof document !== 'undefined') {
      const hoveredSpans = document.querySelectorAll('.comment-hovered');
      hoveredSpans.forEach((span) => {
        span.classList.remove('comment-hovered');
      });
    }
  };

  // 滚动到特定评论并高亮编辑器中的文本
  useEffect(() => {
    if (!activeCommentId || !isPanelOpen || !isMounted || !editor) return;
    if (typeof document === 'undefined') return;

    // 如果正在创建新评论，不执行滚动
    if (isCreatingNewComment) {
      console.log('⏸️ 正在创建新评论，跳过滚动');

      return;
    }

    // 检查这个评论是否真的存在于评论列表中
    const commentExists = comments.some((c) => c.commentId === activeCommentId);

    if (!commentExists) {
      console.warn('⚠️ 评论不存在于列表中，跳过滚动');

      return;
    }

    console.log('🎯 激活评论:', activeCommentId);

    // 清除之前的激活状态
    document.querySelectorAll('.comment-active').forEach((el) => {
      el.classList.remove('comment-active');
    });

    // 高亮当前激活的评论标记
    const activeSpans = document.querySelectorAll(`span[data-comment-id="${activeCommentId}"]`);
    activeSpans.forEach((span) => {
      span.classList.add('comment-active');
    });

    // 滚动到编辑器中的评论
    const scrollTimer = setTimeout(() => {
      const span = document.querySelector(
        `span[data-comment-id="${activeCommentId}"]`,
      ) as HTMLElement;

      if (span) {
        console.log('✅ 找到编辑器中的评论标记');
        span.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      } else {
        console.warn('❌ 未找到编辑器中的评论标记');
      }
    }, 200);

    // 滚动评论面板中的卡片 - 使用直接操作 scrollTop 的方式
    const panelScrollTimer = setTimeout(() => {
      const cardId = `comment-thread-${activeCommentId}`;
      const card = document.getElementById(cardId);

      console.log('🔍 查找评论卡片，ID:', cardId);
      console.log('📋 找到的卡片元素:', card);

      if (card) {
        // 找到卡片的滚动容器
        const scrollContainer = card.closest('.overflow-y-auto') as HTMLElement;
        console.log('📦 滚动容器:', scrollContainer);

        if (scrollContainer) {
          // 直接计算并设置 scrollTop
          const cardTop = card.offsetTop;
          const containerHeight = scrollContainer.clientHeight;
          const cardHeight = card.clientHeight;
          const targetScroll = cardTop - containerHeight / 2 + cardHeight / 2;

          console.log('📊 滚动计算:', {
            cardTop,
            containerHeight,
            cardHeight,
            targetScroll,
          });

          scrollContainer.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
          console.log('✅ 面板滚动完成');
        } else {
          console.warn('⚠️ 未找到滚动容器');
        }
      } else {
        console.error('❌ 未找到评论卡片元素，ID:', cardId);

        // 打印所有存在的卡片 ID
        const allCards = document.querySelectorAll('[id^="comment-thread-"]');
        console.log(
          '📋 现有的评论卡片 ID:',
          Array.from(allCards).map((c) => c.id),
        );
      }
    }, 250);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(panelScrollTimer);

      // 清理激活状态
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.comment-active').forEach((el) => {
          el.classList.remove('comment-active');
        });
      }
    };
  }, [activeCommentId, isPanelOpen, isMounted, editor, isCreatingNewComment, comments]);

  // 在客户端挂载前或面板关闭时不渲染
  if (!isMounted || !isPanelOpen || typeof window === 'undefined') {
    return null;
  }

  const panelContent = (
    <>
      {/* 遮罩层 - 点击时关闭面板 */}
      <div
        className="fixed inset-0 bg-black/5 dark:bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={closePanel}
      />

      {/* 评论面板 */}
      <div
        className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col"
        suppressHydrationWarning
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">评论</h2>
            {comments.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">({comments.length})</span>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={closePanel} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 新建评论输入框 */}
        {isCreatingNewComment && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/30 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/10">
            <div className="p-5">
              {/* 标题区域 */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedText ? (
                      <>
                        为
                        <span className="mx-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          「{selectedText}」
                        </span>
                        添加评论
                      </>
                    ) : (
                      '添加新评论'
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    分享您的想法、建议或问题
                  </p>
                </div>
              </div>

              {/* 输入区域 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">
                    您的评论
                  </label>
                  <Textarea
                    value={newCommentContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewCommentContent(e.target.value)
                    }
                    placeholder="分享您的想法、建议或问题..."
                    className="min-h-[100px] text-sm resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-blue-400/20 dark:focus:ring-blue-500/20"
                    autoFocus
                  />
                </div>

                {/* 按钮组 */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {newCommentContent.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        {newCommentContent.length} 字符
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsCreatingNewComment(false);
                        setNewCommentContent('');
                        setSelectedText('');
                      }}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateComment}
                      disabled={!newCommentContent.trim() || isSubmitting}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          发布中...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          发布评论
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 或显示添加评论按钮 */}
        {!isCreatingNewComment && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => setIsCreatingNewComment(true)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加评论
            </Button>
          </div>
        )}

        {/* 评论列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">还没有评论</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  选择文本并点击上方按钮添加评论
                </p>
              </div>
            ) : (
              comments.map((thread) => (
                <div key={thread.id} id={`comment-thread-${thread.commentId}`}>
                  <CommentThread
                    thread={thread}
                    isActive={activeCommentId === thread.commentId}
                    isHovered={hoveredCommentId === thread.commentId}
                    onResolve={() => handleResolveComment(thread.id)}
                    onDelete={() => handleDeleteComment(thread)}
                    onHover={() => handleThreadHover(thread.commentId)}
                    onLeave={handleThreadLeave}
                    onCardClick={() => setActiveCommentId(thread.commentId)}
                    currentUserId={currentUserId}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );

  // 使用 Portal 将面板渲染到 document.body
  return createPortal(panelContent, document.body);
}

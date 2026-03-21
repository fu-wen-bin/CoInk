'use client';

import { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';

interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface TocPanelProps {
  editor: Editor | null;
  isOpen: boolean;
}

export function TocPanel({ editor, isOpen }: TocPanelProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [cursorHeadingId, setCursorHeadingId] = useState<string | null>(null);
  const [hoverHeadingId, setHoverHeadingId] = useState<string | null>(null);

  // 提取文档中的标题
  useEffect(() => {
    if (!editor) return;

    const updateToc = () => {
      const headings: TocItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({
            id: `heading-${pos}`,
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setItems(headings);
    };

    updateToc();
    editor.on('transaction', updateToc);
    return () => editor.off('transaction', updateToc);
  }, [editor]);

  // 监听光标位置，高亮当前光标所在标题
  useEffect(() => {
    if (!editor) return;

    const updateCursorHeading = () => {
      const { from } = editor.state.selection;
      let found: string | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && pos <= from) {
          found = `heading-${pos}`;
        }
      });
      setCursorHeadingId(found);
    };

    editor.on('selectionUpdate', updateCursorHeading);
    updateCursorHeading();
    return () => editor.off('selectionUpdate', updateCursorHeading);
  }, [editor]);

  const scrollToHeading = (pos: number, e: React.MouseEvent) => {
    if (!editor) return;
    e.stopPropagation();
    editor.commands.focus();
    editor.commands.setTextSelection(pos);
    const node = editor.view.nodeDOM(pos);
    if (node instanceof Element) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      className="absolute top-0 left-0 h-full w-[220px] z-20 flex flex-col bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
    >
      {/* 标题栏 */}
      <div className="px-4 py-3 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">目录</span>
      </div>

      {/* 目录列表 */}
      <nav className="flex-1 overflow-y-auto pb-4">
        {items.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">暂无标题</div>
        ) : (
          items.map((item) => {
            const isActive = cursorHeadingId === item.id;
            const isHover = hoverHeadingId === item.id;
            const highlighted = isActive || isHover;

            return (
              <button
                key={item.id}
                onClick={(e) => scrollToHeading(item.pos, e)}
                onMouseEnter={() => setHoverHeadingId(item.id)}
                onMouseLeave={() => setHoverHeadingId(null)}
                className={`w-full text-left py-1.5 text-base cursor-pointer transition-colors duration-150 ${
                  highlighted
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                style={{ paddingLeft: `${16 + (item.level - 1) * 14}px`, paddingRight: '12px' }}
              >
                <span className="block truncate">{item.text}</span>
              </button>
            );
          })
        )}
      </nav>
    </div>
  );
}

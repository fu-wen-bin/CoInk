'use client';

import type { Editor } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';

import { cn } from '@/utils/cn';

interface CodeBlockComponentProps extends Omit<ReactNodeViewProps, 'getPos'> {
  editor: Editor;
  getPos: () => number | undefined;
}

/**
 * Notion-like：仅代码区域，无语言选择 / 复制 / 格式化 / 主题工具栏。
 */
function CodeBlockComponent(props: CodeBlockComponentProps) {
  const { extension } = props;
  const { showLineNumbers = false } = extension.options;

  return (
    <NodeViewWrapper className="code-block notion-code-block">
      <div className="code-block-content">
        <pre className={cn('hljs', showLineNumbers ? 'line-numbers' : '')}>
          <NodeViewContent as="div" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

export default CodeBlockComponent;

'use client';

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CommandProps, textblockTypeInputRule } from '@tiptap/core';

import CodeBlockComponent from './CodeBlockComponent';

const lowlight = createLowlight(common);

interface CodeBlockOptions {
  lowlight: typeof lowlight;
  defaultLanguage: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
}

export const CodeBlock = CodeBlockLowlight.extend<CodeBlockOptions>({
  priority: 300,

  addOptions() {
    return {
      ...this.parent?.(),
      lowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: {
        class: 'hljs',
      },
      showLineNumbers: false,
      maxHeight: undefined,
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      createCodeBlock:
        () =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { language: 'javascript' },
          });
        },
    };
  },
  addInputRules() {
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      rb: 'ruby',
      sh: 'bash',
      yml: 'yaml',
      md: 'markdown',
      jsx: 'javascript',
      tsx: 'typescript',
    };

    return [
      textblockTypeInputRule({
        find: /^```([a-z]*)?[\s\n]$/,
        type: this.type,
        getAttributes: (match) => {
          const inputLanguage = match[1] || 'plaintext';
          const language = languageMap[inputLanguage] || inputLanguage;

          return { language };
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() || {};

    return {
      ...parentShortcuts,
      Tab: () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        if ($from.parent.type.name === 'codeBlock') {
          return this.editor.commands.insertContent('  ');
        }

        return false;
      },
      'Shift-Tab': () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        if ($from.parent.type.name === 'codeBlock') {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to);
          const line = state.doc.resolve(from).parent.textContent;
          const lineStart = from - text.length + (line.length - line.trimStart().length);

          if (line.startsWith('  ')) {
            const deleteFrom = Math.max(lineStart, from - 2);

            return this.editor.commands.deleteRange({ from: deleteFrom, to: from });
          }
        }

        return false;
      },
      'Mod-/': () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        if ($from.parent.type.name === 'codeBlock') {
          const language = $from.parent.attrs.language || 'plaintext';

          const commentSymbols: Record<string, string> = {
            javascript: '//',
            typescript: '//',
            java: '//',
            c: '//',
            cpp: '//',
            csharp: '//',
            go: '//',
            rust: '//',
            swift: '//',
            kotlin: '//',
            php: '//',
            ruby: '#',
            python: '#',
            shell: '#',
            bash: '#',
            sql: '--',
            css: '/*',
            scss: '//',
            less: '//',
            json: '//',
            yaml: '#',
            xml: '<!--',
            html: '<!--',
            markdown: '<!--',
          };

          const commentSymbol = commentSymbols[language] || '//';
          const { from, to } = state.selection;
          const codeBlockContent = $from.parent.textContent;
          const codeBlockStart = $from.start();
          const codeBlockEnd = $from.end();
          const relativeFrom = from - codeBlockStart;
          const relativeTo = to - codeBlockStart;
          const lines = codeBlockContent.split('\n');
          const startLineIndex = codeBlockContent.substring(0, relativeFrom).split('\n').length - 1;
          const endLineIndex = codeBlockContent.substring(0, relativeTo).split('\n').length - 1;

          let allCommented = true;

          for (let i = startLineIndex; i <= endLineIndex; i++) {
            const trimmedLine = lines[i].trimStart();

            if (!trimmedLine.startsWith(commentSymbol)) {
              allCommented = false;
              break;
            }
          }

          const newLines = lines.map((line, index) => {
            if (index < startLineIndex || index > endLineIndex) {
              return line;
            }

            const trimmedLine = line.trimStart();
            const leadingWhitespace = line.substring(0, line.length - trimmedLine.length);

            if (allCommented) {
              if (trimmedLine.startsWith(commentSymbol)) {
                return leadingWhitespace + trimmedLine.substring(commentSymbol.length).trimStart();
              }

              return line;
            } else {
              return leadingWhitespace + commentSymbol + ' ' + trimmedLine;
            }
          });

          const newContent = newLines.join('\n');

          return this.editor
            .chain()
            .focus()
            .deleteRange({ from: codeBlockStart, to: codeBlockEnd })
            .insertContent(newContent)
            .run();
        }

        return false;
      },
    };
  },

  renderHTML({ HTMLAttributes, node }) {
    const { language } = HTMLAttributes;
    const codeContent = node.textContent || '';

    return [
      'pre',
      { class: 'hljs' },
      ['code', { class: language ? `language-${language}` : '' }, codeContent],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent, {
      contentDOMElementTag: 'code',
    });
  },
}).configure({
  lowlight,
  defaultLanguage: 'javascript',
  showLineNumbers: false,
});

'use client';

import type { Editor } from '@tiptap/react';
import { generateJSON } from '@tiptap/html';

import { toastError, toastInfo, toastSuccess } from '@/utils/toast';
import { StaticExtensionKit } from '@/extensions/extension-kit';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MARKDOWN_MIME = 'text/markdown';
const PLAIN_TEXT_MIME = 'text/plain';
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'docx']);

export const DOCUMENT_IMPORT_ACCEPT = '.md,.markdown,.txt,.docx';
export const DOCUMENT_IMPORT_ALLOWED_MIME_TYPES = [
  DOCX_MIME,
  MARKDOWN_MIME,
  PLAIN_TEXT_MIME,
  '.md',
  '.markdown',
  '.txt',
  '.docx',
];

type ImportSource = 'picker' | 'drop' | 'paste';

interface ImportOptions {
  insertPosition?: number;
  source?: ImportSource;
}

interface ParseResult {
  html: string;
  warnings: string[];
  plainText?: string;
}

export interface ParsedImportDocument {
  html: string;
  content: Record<string, unknown>;
  warnings: string[];
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

async function sanitizeHtml(html: string): Promise<string> {
  if (typeof window === 'undefined') return html;
  const { default: DOMPurify } = await import('dompurify');
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

async function parseMarkdownFile(file: File): Promise<ParseResult> {
  const content = await file.text();
  const { default: MarkdownIt } = await import('markdown-it');
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
  });

  return {
    html: markdown.render(content),
    warnings: [],
    plainText: content,
  };
}

async function parseDocxFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await import('mammoth');
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer }),
  ]);

  return {
    html: htmlResult.value,
    warnings: [
      ...(htmlResult.messages?.map((message) => message.message) ?? []),
      ...(textResult.messages?.map((message) => message.message) ?? []),
    ],
    plainText: textResult.value ?? '',
  };
}

async function parseTextFile(file: File): Promise<ParseResult> {
  const content = await file.text();
  return {
    html: plainTextToHtml(content),
    warnings: [],
    plainText: content,
  };
}

async function parseImportFile(file: File): Promise<ParseResult> {
  const extension = getFileExtension(file.name);

  if (extension === 'docx') {
    return parseDocxFile(file);
  }

  if (extension === 'md' || extension === 'markdown') {
    return parseMarkdownFile(file);
  }

  return parseTextFile(file);
}

export async function parseDocumentFileToTiptapJson(file: File): Promise<ParsedImportDocument> {
  const parsed = await parseImportFile(file);
  const sanitizedHtml = await sanitizeHtml(parsed.html);
  let content: Record<string, unknown>;

  try {
    content = generateJSON(sanitizedHtml, StaticExtensionKit as any) as Record<string, unknown>;
  } catch {
    content = { type: 'doc' };
  }

  const hasStructuredContent =
    content.type === 'doc' &&
    Array.isArray((content as { content?: unknown[] }).content) &&
    ((content as { content?: unknown[] }).content?.length ?? 0) > 0;

  if (!hasStructuredContent) {
    const fallbackText = (parsed.plainText ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim();

    if (fallbackText) {
      const blocks = fallbackText
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

      content = {
        type: 'doc',
        content:
          blocks.length > 0
            ? blocks.map((block) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: block }],
              }))
            : [{ type: 'paragraph' }],
      };
    } else {
      content = { type: 'doc', content: [{ type: 'paragraph' }] };
    }
  }

  return {
    html: sanitizedHtml,
    content,
    warnings: parsed.warnings,
  };
}

export function isSupportedDocumentImportFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) return false;

  if (!file.type) return true;
  if (file.type === DOCX_MIME || file.type === MARKDOWN_MIME || file.type === PLAIN_TEXT_MIME) {
    return true;
  }

  if (extension === 'md' || extension === 'markdown') return true;
  if (file.type === 'application/octet-stream' && extension === 'docx') {
    return true;
  }

  return false;
}

function insertHtmlToEditor(editor: Editor, html: string, insertPosition?: number): boolean {
  const chain = editor.chain();
  if (typeof insertPosition === 'number') {
    chain.focus(insertPosition);
  } else {
    chain.focus();
  }

  return chain.insertContent(html).run();
}

export async function importDocumentFileToEditor(
  editor: Editor,
  file: File,
  options?: ImportOptions,
): Promise<boolean> {
  if (!editor?.isEditable) {
    toastError('当前文档不可编辑，无法导入文件');
    return false;
  }

  if (!isSupportedDocumentImportFile(file)) {
    toastError('仅支持导入 .md、.markdown、.txt、.docx 文件');
    return false;
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    toastError('导入文件大小不能超过 10MB');
    return false;
  }

  try {
    const parsed = await parseDocumentFileToTiptapJson(file);
    const sanitizedHtml = parsed.html;

    if (!sanitizedHtml.trim()) {
      toastError('文件内容为空或无法解析');
      return false;
    }

    const inserted = insertHtmlToEditor(editor, sanitizedHtml, options?.insertPosition);
    if (!inserted) {
      toastError('导入失败：无法将内容插入编辑器');
      return false;
    }

    if (parsed.warnings.length > 0) {
      toastInfo('文档已导入，部分格式已自动简化');
    } else if (options?.source !== 'drop' && options?.source !== 'paste') {
      toastSuccess('文档导入成功');
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入文件失败';
    toastError(message || '导入文件失败');
    return false;
  }
}

export function openDocumentImportPicker(editor: Editor): void {
  if (typeof document === 'undefined') return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = DOCUMENT_IMPORT_ACCEPT;
  input.multiple = false;

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void importDocumentFileToEditor(editor, file, { source: 'picker' });
  };

  input.click();
}

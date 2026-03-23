import { TiptapTransformer } from '@hocuspocus/transformer';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import type { Doc } from 'yjs';

import type { Prisma } from '../../generated/prisma/client';

/** 与前端 `Collaboration` 未指定 `field` 时的 TipTap 默认片段名一致 */
export const TIPTAP_COLLABORATION_FIELD = 'default' as const;

/** 新建空文档时的 Tiptap JSON */
export const EMPTY_TIPTAP_DOCUMENT_JSON: Prisma.InputJsonValue = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
};

function parseJsonContent(content: Prisma.JsonValue): unknown {
  if (content === null || content === undefined) {
    return null;
  }
  if (typeof content === 'string') {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      return null;
    }
  }
  return content;
}

function isTiptapDocJson(value: unknown): value is { type: 'doc'; content?: unknown[] } {
  return typeof value === 'object' && value !== null && (value as { type?: string }).type === 'doc';
}

/**
 * 旧版曾将 Yjs update 的 base64 存在 `content` JSON 字段中
 */
function tryDecodeLegacyYjsBase64Content(content: Prisma.JsonValue): Uint8Array | null {
  if (typeof content !== 'string') {
    return null;
  }
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return null;
  }
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length < 2) {
      return null;
    }
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * 将库里的行加载到 Hocuspocus 的 Y.Doc：
 * 1. 有 `y_state` 时优先应用（协同权威快照）
 * 2. 否则用 Tiptap JSON 播种
 * 3. 再否则兼容旧 base64 Yjs
 */
export function applyStoredDocumentToYdoc(
  document: Doc,
  row: { content: Prisma.JsonValue; y_state: Buffer | Uint8Array | null },
): void {
  if (row.y_state && row.y_state.length > 0) {
    applyUpdate(document, new Uint8Array(row.y_state));
    return;
  }

  const parsed = parseJsonContent(row.content);
  if (isTiptapDocJson(parsed)) {
    const seed = TiptapTransformer.toYdoc(parsed, TIPTAP_COLLABORATION_FIELD);
    applyUpdate(document, encodeStateAsUpdate(seed));
    return;
  }

  const legacy = tryDecodeLegacyYjsBase64Content(row.content);
  if (legacy) {
    applyUpdate(document, legacy);
  }
}

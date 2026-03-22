'use client';

import { Ai } from '@tiptap-pro/extension-ai';
import type { AiTextResolverOptions } from '@tiptap-pro/extension-ai';

/**
 * 设为 `true` 且在 Nest 配置 DEEPSEEK_API_KEY 后，才会注册 TipTap AI 扩展。
 * 未开启时不 import 额外异步逻辑，编辑器扩展列表不包含 Ai，与现状一致。
 */
export const EDITOR_AI_ENABLED = process.env.NEXT_PUBLIC_EDITOR_AI_ENABLED === 'true';

type GetToken = () => string | null | undefined;

/**
 * 占位 appId/token：使用自定义 `aiStreamResolver` 时不会请求 TipTap 云端，仅满足类型与扩展内部校验。
 */
const PLACEHOLDER_APP_ID = 'coink-local';
const PLACEHOLDER_TOKEN = 'unused-with-custom-resolver';

export function createEditorAiExtension(getAccessToken?: GetToken) {
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '');

  return Ai.configure({
    appId: PLACEHOLDER_APP_ID,
    token: PLACEHOLDER_TOKEN,
    autocompletion: false,
    showDecorations: true,
    hideDecorationsOnStreamEnd: true,
    aiStreamResolver: async (options: AiTextResolverOptions) => {
      if (!serverUrl) {
        console.warn('[editor-ai] NEXT_PUBLIC_SERVER_URL 未设置，无法请求 Nest AI 流');
        return null;
      }

      const token = getAccessToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${serverUrl}/ai/editor/stream`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          action: options.action,
          text: options.text,
          textOptions: options.textOptions ?? {},
        }),
        signal: options.aborter?.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `AI 流式请求失败: HTTP ${res.status}`);
      }

      return res.body;
    },
  });
}

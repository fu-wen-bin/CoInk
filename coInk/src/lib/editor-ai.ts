'use client';

import type { Editor } from '@tiptap/react';
import { Ai } from '@tiptap-pro/extension-ai';
import type { AiStorage, AiTextResolverOptions } from '@tiptap-pro/extension-ai';

import type { UiState } from '@/components/tiptap-extension/ui-state-extension';

function getAiIdleResponseLength(editor: Editor): number {
  const ai = editor.storage.ai as AiStorage | undefined;
  if (!ai || ai.state !== 'idle') return 0;
  if (typeof ai.response !== 'string') return 0;
  return ai.response.trim().length;
}

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
    /**
     * 与 notion-like 模板一致：把 TipTap AI 流式阶段同步到 `UiState`，
     * 否则 `aiGenerationIsLoading` 不更新，AI 菜单里的加载动画（三点跳动）不会出现。
     */
    onLoading: (context) => {
      context.editor.commands.aiGenerationSetIsLoading(true);
      context.editor.commands.aiGenerationHasMessage(false);
    },
    onChunk: (context) => {
      context.editor.commands.aiGenerationSetIsLoading(true);
      context.editor.commands.aiGenerationHasMessage(true);
    },
    onSuccess: (context) => {
      const { editor } = context;
      editor.commands.aiGenerationSetIsLoading(false);
      /**
       * 流式结束时 `onSuccess` 有时不带 `context.response`，若仅用 `!!context.response`
       * 会把 `onChunk` 已置为 true 的 `aiGenerationHasMessage` 错误清掉，
       * 导致 Apply / Discard / Try again 整行不出现。
       */
      const fromCallback = (context.response ?? '').trim().length > 0;
      const fromAiStorage = getAiIdleResponseLength(editor) > 0;
      const ui = editor.storage.uiState as Partial<UiState> | undefined;
      const fromChunks = ui?.aiGenerationHasMessage === true;
      const hasMessage = fromCallback || fromAiStorage || fromChunks;
      editor.commands.aiGenerationHasMessage(hasMessage);
    },
    onError: (_error, context) => {
      context.editor.commands.aiGenerationSetIsLoading(false);
      context.editor.commands.aiGenerationHasMessage(false);
    },
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

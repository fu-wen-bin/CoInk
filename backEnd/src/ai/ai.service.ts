import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { EditorAiStreamDto } from './dto/editor-ai-stream.dto';

/**
 * DeepSeek 使用 OpenAI 兼容 API：POST {DEEPSEEK_BASE_URL}/v1/chat/completions
 *
 * 环境变量（在 .env 中填写）：
 * - DEEPSEEK_API_KEY（必填才能启用）
 * - DEEPSEEK_BASE_URL（可选，默认 https://api.deepseek.com）
 * - DEEPSEEK_MODEL（可选，默认 deepseek-chat）
 * - DEEPSEEK_SYSTEM_PROMPT（可选，系统提示）
 */

@Injectable()
export class AiService {
  isConfigured(): boolean {
    const key = process.env.DEEPSEEK_API_KEY?.trim();
    return Boolean(key && key !== 'YOUR_DEEPSEEK_API_KEY');
  }

  /**
   * 将 DeepSeek 的 SSE 转为 **纯文本/HTML 片段字节流**，
   * 与 `@tiptap-pro/extension-ai` 默认云端流格式一致（逐块 UTF-8，非 OpenAI JSON 行）。
   */
  async *streamEditorCompletion(dto: EditorAiStreamDto): AsyncGenerator<Buffer> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('AI 未配置：请在服务端 .env 中设置 DEEPSEEK_API_KEY');
    }

    const apiKey = process.env.DEEPSEEK_API_KEY as string;
    const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(
      /\/$/,
      '',
    );
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

    const messages = this.buildDeepseekMessages(dto);

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`DeepSeek HTTP ${res.status}: ${errBody}`);
    }

    if (!res.body) {
      throw new Error('DeepSeek 响应无 body');
    }

    yield* this.parseOpenAiSseToTextChunks(res.body);
  }

  private buildDeepseekMessages(dto: EditorAiStreamDto): { role: string; content: string }[] {
    const system =
      process.env.DEEPSEEK_SYSTEM_PROMPT?.trim() ||
      [
        '你是文档编辑器内的写作助手。',
        '用户会提供 action（操作类型）与选中文本；请按要求改写或生成。',
        '若 textOptions.format 为 rich-text，请输出可直接插入编辑器的 HTML 片段（与 TipTap 兼容的简洁 HTML）；',
        '若为 plain-text 或未指定，请输出纯文本。',
        '输出语言必须与「选中文本」一致：若选区以中文为主，请用中文作答；若以英文为主，请用英文作答。',
        '除非用户明确要求某种语言，或 action 为 translate 且 textOptions.language 指定了目标语言，否则不要用另一种语言覆盖用户语言。',
        'action 仅为 TipTap 内部枚举（如 adjust-tone、translate），不是要求你用英文回复；请按上述语言规则输出。',
        'textOptions 中含二级选项：tone（语气）、language（翻译目标语言 ISO 639-1）等，请严格遵循。',
      ].join('\n');

    const userContent = this.buildUserPrompt(dto);

    return [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ];
  }

  /**
   * TipTap 菜单项只影响前端展示的 action / textOptions；提示词集中在此方法即可。
   * 二级菜单（语气、翻译语言等）在 textOptions.tone、textOptions.language 等字段中。
   */
  private buildUserPrompt(dto: EditorAiStreamDto): string {
    const format = (dto.textOptions?.format as string | undefined) ?? 'plain-text';
    const opts = dto.textOptions ?? {};
    const optsJson = Object.keys(opts).length > 0 ? JSON.stringify(opts, null, 2) : '(无附加选项)';

    return [
      `action: ${dto.action}`,
      `format: ${format}`,
      '',
      '--- textOptions（含二级菜单参数，如 tone / language / textLength 等）---',
      optsJson,
      '',
      '--- 选中文本 / 上下文 ---',
      dto.text,
    ].join('\n');
  }

  private async *parseOpenAiSseToTextChunks(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<Buffer> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield Buffer.from(content, 'utf8');
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

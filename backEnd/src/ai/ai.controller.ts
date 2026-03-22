import { Body, Controller, Post, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';

import { AiService } from './ai.service';
import { EditorAiStreamDto } from './dto/editor-ai-stream.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * TipTap AI 扩展流式输出（纯 UTF-8 片段，非 JSON 包装）。
   * TODO: 按需加 JwtAuthGuard / ApiBearerAuth，并从 req.user 取用户身份。
   */
  @Post('editor/stream')
  async editorStream(@Body() dto: EditorAiStreamDto, @Res() res: Response): Promise<void> {
    if (!this.aiService.isConfigured()) {
      throw new ServiceUnavailableException('AI 未配置：请设置环境变量 DEEPSEEK_API_KEY');
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of this.aiService.streamEditorCompletion(dto)) {
        res.write(chunk);
      }
      res.end();
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({
          message: e instanceof Error ? e.message : 'AI stream error',
        });
        return;
      }
      res.end();
    }
  }
}

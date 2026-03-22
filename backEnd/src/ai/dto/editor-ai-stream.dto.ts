import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * 与 TipTap `@tiptap-pro/extension-ai` 的 aiStreamResolver 请求体对齐（由前端转发）。
 */
export class EditorAiStreamDto {
  @IsString()
  action!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsObject()
  textOptions?: Record<string, unknown>;
}

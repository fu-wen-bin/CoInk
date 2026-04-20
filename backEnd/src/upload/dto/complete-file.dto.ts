import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CompleteFileDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileHash: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  fileSize?: number;

  /**
   * 兼容旧字段名（与 fileSize 含义一致）
   */
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  totalSize?: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  totalChunks?: number;
}

import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UploadChunkDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  chunkIndex: number;

  /**
   * 兼容旧字段名（与 chunkIndex 含义一致）
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  chunkNumber?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalChunks: number;

  @IsString()
  @IsNotEmpty()
  fileHash: string;

  @IsString()
  @IsOptional()
  chunkHash?: string;
}

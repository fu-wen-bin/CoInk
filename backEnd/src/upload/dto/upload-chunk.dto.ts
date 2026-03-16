import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UploadChunkDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  chunkIndex: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalChunks: number;

  @IsString()
  @IsNotEmpty()
  fileHash: string;

  @IsString()
  @IsNotEmpty()
  chunkHash: string;
}

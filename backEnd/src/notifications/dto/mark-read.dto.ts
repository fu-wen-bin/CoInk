import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkReadDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  notificationId?: bigint;
}

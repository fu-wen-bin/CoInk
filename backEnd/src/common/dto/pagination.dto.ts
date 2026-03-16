import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  @Max(100, { message: '每页数量最大为100' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));

  return {
    items,
    total,
    page: validPage,
    limit: validLimit,
    totalPages: Math.ceil(total / validLimit),
  };
}

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

// 统一响应结构类型
type ApiEnvelope<T = unknown> = {
  code: string;
  message: string;
  data: T;
};

// 判断返回值是否已是统一结构
const isApiEnvelope = (value: unknown): value is ApiEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return 'code' in record && 'message' in record;
};

// 全局响应拦截器：统一包裹成功响应为 { code, message, data }
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  // 统一处理所有成功响应
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // 若已是统一格式，则直接透传，避免二次包裹
        if (isApiEnvelope(data)) {
          return data;
        }

        // 默认成功包裹
        return {
          code: '1',
          message: 'success',
          data,
        } as ApiEnvelope;
      }),
    );
  }
}

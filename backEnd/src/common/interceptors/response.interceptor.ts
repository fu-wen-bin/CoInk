import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

// 统一响应结构类型
type ApiEnvelope<T = unknown> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
};

// 判断返回值是否已是统一结构
const isApiEnvelope = (value: unknown): value is ApiEnvelope<unknown> => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  // 检查 code 是否存在且是数字或字符串类型的数字
  return 'code' in record && 'message' in record && 'data' in record;
};

// 全局响应拦截器：统一包裹成功响应为 { code, message, data }
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  // 统一处理所有成功响应
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ url?: string }>();
    // 流式接口自行写入 Response，不能包一层 { code, data }
    if (typeof req?.url === 'string' && req.url.includes('/ai/editor/stream')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        // 若已是统一格式，则直接透传，避免二次包裹
        if (isApiEnvelope(data)) {
          return data;
        }

        // 默认成功包裹 - 使用数字 200 作为成功状态码
        return {
          code: 200,
          message: 'success',
          data,
          timestamp: Date.now(),
        } as ApiEnvelope<unknown>;
      }),
    );
  }
}

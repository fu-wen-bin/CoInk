import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

// 全局异常过滤器：统一错误响应格式
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  // 捕获所有异常并标准化输出
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException ? exception.getResponse() : null;
    const message = this.extractMessage(errorResponse) ?? '服务器异常';

    // 统一错误响应结构
    response.status(status).json({
      code: '0',
      message,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  // 从异常对象中提取可读错误信息
  private extractMessage(errorResponse: unknown): string | null {
    if (!errorResponse) return null;
    if (typeof errorResponse === 'string') return errorResponse;
    if (typeof errorResponse === 'object' && errorResponse !== null) {
      const message = (errorResponse as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join('；');
      }
      if (typeof message === 'string') return message;
    }
    return null;
  }
}

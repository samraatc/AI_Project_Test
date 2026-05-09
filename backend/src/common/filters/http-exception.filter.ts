import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse();
    const req    = ctx.getRequest();
    const ex     = exception as any;
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException
      ? (() => { const r = exception.getResponse(); return typeof r === 'object' ? (r as any).message : r; })()
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, ex?.stack);
    }

    res.status(status).json({
      statusCode: status,
      timestamp:  new Date().toISOString(),
      path:       req.url,
      message,
    });
  }
}

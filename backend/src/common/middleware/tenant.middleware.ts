import { Injectable, NestMiddleware } from '@nestjs/common';
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) req.tenantId = tenantId;
    next();
  }
}

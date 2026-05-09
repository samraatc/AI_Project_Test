import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../modules/auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbOk = false;
    try { await this.ds.query('SELECT 1'); dbOk = true; } catch {}
    return { status: dbOk ? 'ok' : 'degraded', database: dbOk ? 'connected' : 'disconnected', timestamp: new Date().toISOString() };
  }
}

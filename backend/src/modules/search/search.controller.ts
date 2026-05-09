import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('search') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard) @Controller('search')
export class SearchController {
  constructor(private svc: SearchService) {}
  @Get() search(@Query('q') q: string, @CurrentUser() u: any) { return this.svc.globalSearch(q||'', u.tenantId); }
}

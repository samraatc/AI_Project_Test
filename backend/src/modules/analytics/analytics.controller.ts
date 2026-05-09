import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('analytics') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}
  @Get('dashboard')    @RequirePermissions('analytics:read') dashboard(@CurrentUser() u: any)                      { return this.svc.getDashboard(u.tenantId); }
  @Get('ai-accuracy')  @RequirePermissions('analytics:read') aiAccuracy(@CurrentUser() u: any)                     { return this.svc.getAiAccuracy(u.tenantId); }
  @Get('projects/:id') @RequirePermissions('analytics:read') projAnalytics(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.getProjectAnalytics(id, u.tenantId); }
}

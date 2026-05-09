import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('approvals') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('approvals')
export class ApprovalsController {
  constructor(private svc: ApprovalsService) {}
  @Post('submit')                @RequirePermissions('estimations:write')  submit(@Body() dto: any, @CurrentUser() u: any)                                        { return this.svc.submit(dto.estimationId, dto.approverIds, u.tenantId, u.id); }
  @Post(':id/decide')            @RequirePermissions('estimations:approve') decide(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any)              { return this.svc.decide(id, dto.decision, dto.comments, u.id, u.tenantId); }
  @Get(':id')                    @RequirePermissions('estimations:read')    one(@Param('id') id: string, @CurrentUser() u: any)                                   { return this.svc.getWorkflow(id, u.tenantId); }
  @Get('estimation/:eid')        @RequirePermissions('estimations:read')    byEst(@Param('eid') eid: string, @CurrentUser() u: any)                               { return this.svc.getByEstimation(eid, u.tenantId); }
  @Get('my/pending')             @RequirePermissions('estimations:read')    @ApiOperation({ summary: 'My pending approvals' }) pending(@CurrentUser() u: any)    { return this.svc.myPending(u.id); }
}

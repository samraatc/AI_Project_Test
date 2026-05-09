import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiOrchestrationService } from './services/ai-orchestration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ai') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard) @Controller('ai')
export class AiController {
  constructor(private svc: AiOrchestrationService) {}
  @Post('projects/:id/analyze')    @RequirePermissions('estimations:write') @ApiOperation({ summary: 'Trigger AI pipeline' })
  analyze(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.runFullPipeline(id, u.tenantId, u.id); }
  @Get('projects/:id/status')      @RequirePermissions('estimations:read')
  status(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.getPipelineStatus(id, u.tenantId); }
  @Post('projects/:id/re-analyze') @RequirePermissions('estimations:write')
  reAnalyze(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.reAnalyze(id, u.tenantId, u.id); }
}

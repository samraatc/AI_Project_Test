import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EstimationsService } from './estimations.service';
import { AiOrchestrationService } from '../ai/services/ai-orchestration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('estimations') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('estimations')
export class EstimationsController {
  constructor(private svc: EstimationsService, private ai: AiOrchestrationService) {}

  @Get('all')             @RequirePermissions('estimations:read') findAll(@Query() q: any, @CurrentUser() u: any)                                { return this.svc.findAll(u.tenantId, q); }
  @Get()                  @RequirePermissions('estimations:read') list(@Query('projectId') pid: string, @CurrentUser() u: any)                   { return this.svc.findByProject(pid, u.tenantId); }
  @Get('compare/:a/:b')   @RequirePermissions('estimations:read') compare(@Param('a') a: string, @Param('b') b: string, @CurrentUser() u: any)   { return this.svc.compare(a, b, u.tenantId); }
  @Get(':id')             @RequirePermissions('estimations:read') one(@Param('id') id: string, @CurrentUser() u: any)                            { return this.svc.findOne(id, u.tenantId); }
  @Post()                 @RequirePermissions('estimations:write') create(@Body() dto: any, @CurrentUser() u: any)                               { return this.svc.create(dto, u.tenantId, u.id); }
  @Patch(':id')           @RequirePermissions('estimations:write') update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any)      { return this.svc.update(id, dto, u.tenantId, u.id); }
  @Post(':id/items')      @RequirePermissions('estimations:write') upsertItem(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any)  { return this.svc.upsertItem(id, dto, u.tenantId, u.id); }
  @Post(':id/items/bulk') @RequirePermissions('estimations:write') bulkUpdate(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any)  { return this.svc.bulkUpdateItems(id, dto.items||[], u.tenantId); }
  @Delete(':id/items/:iid') @RequirePermissions('estimations:write') @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(@Param('id') id: string, @Param('iid') iid: string, @CurrentUser() u: any) { return this.svc.deleteItem(id, iid, u.tenantId); }
  @Post(':id/version') @RequirePermissions('estimations:write') version(@Param('id') id: string, @CurrentUser() u: any)                         { return this.svc.createVersion(id, u.tenantId, u.id); }
  @Post(':id/lock')    @RequirePermissions('estimations:approve') lock(@Param('id') id: string, @CurrentUser() u: any)                          { return this.svc.lock(id, u.tenantId, u.id); }
  @Post(':id/unlock')  @RequirePermissions('estimations:approve') unlock(@Param('id') id: string, @CurrentUser() u: any)                        { return this.svc.unlock(id, u.tenantId); }
  @Post('project/:pid/analyze') @RequirePermissions('estimations:write') analyze(@Param('pid') pid: string, @CurrentUser() u: any)              { return this.ai.runFullPipeline(pid, u.tenantId, u.id); }
  @Get('project/:pid/status')   @RequirePermissions('estimations:read')  status(@Param('pid') pid: string, @CurrentUser() u: any)               { return this.ai.getPipelineStatus(pid, u.tenantId); }
}

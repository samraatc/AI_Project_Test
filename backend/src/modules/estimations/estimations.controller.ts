import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EstimationsService }   from './estimations.service';
import { AiOrchestrationService } from '../ai/services/ai-orchestration.service';
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard }      from '../auth/guards/permissions.guard';
import { RequirePermissions }    from '../auth/decorators/permissions.decorator';
import { CurrentUser }           from '../auth/decorators/current-user.decorator';

@ApiTags('estimations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('estimations')
export class EstimationsController {
  constructor(
    private svc: EstimationsService,
    private ai:  AiOrchestrationService,
  ) {}

  // ── IMPORTANT: Specific static routes MUST come before :id routes ──

  @Get('all')
  @RequirePermissions('estimations:read')
  @ApiOperation({ summary: 'List all estimations for tenant' })
  findAll(@Query() q: any, @CurrentUser() u: any) {
    return this.svc.findAll(u.tenantId, q);
  }

  @Get('compare/:a/:b')
  @RequirePermissions('estimations:read')
  @ApiOperation({ summary: 'Compare two estimation versions' })
  compare(@Param('a') a: string, @Param('b') b: string, @CurrentUser() u: any) {
    return this.svc.compare(a, b, u.tenantId);
  }

  // ── Project-scoped routes (MUST be before :id to avoid shadowing) ──

  @Post('project/:pid/analyze')
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Trigger AI analysis pipeline' })
  analyze(@Param('pid') pid: string, @CurrentUser() u: any) {
    return this.ai.runFullPipeline(pid, u.tenantId, u.id);
  }

  @Get('project/:pid/status')
  @RequirePermissions('estimations:read')
  @ApiOperation({ summary: 'Get AI pipeline status' })
  status(@Param('pid') pid: string, @CurrentUser() u: any) {
    return this.ai.getPipelineStatus(pid, u.tenantId);
  }

  // ── Dynamic :id routes (MUST come after all static routes) ──

  @Get()
  @RequirePermissions('estimations:read')
  @ApiOperation({ summary: 'List estimations for a project' })
  list(@Query('projectId') pid: string, @CurrentUser() u: any) {
    return this.svc.findByProject(pid, u.tenantId);
  }

  @Get(':id')
  @RequirePermissions('estimations:read')
  @ApiOperation({ summary: 'Get estimation by ID' })
  one(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.findOne(id, u.tenantId);
  }

  @Post()
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Create estimation' })
  create(@Body() dto: any, @CurrentUser() u: any) {
    return this.svc.create(dto, u.tenantId, u.id);
  }

  @Patch(':id')
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Update estimation' })
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) {
    return this.svc.update(id, dto, u.tenantId, u.id);
  }

  @Post(':id/items')
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Add or update a line item' })
  upsertItem(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) {
    return this.svc.upsertItem(id, dto, u.tenantId, u.id);
  }

  @Post(':id/items/bulk')
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Bulk update line items' })
  bulkUpdate(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) {
    return this.svc.bulkUpdateItems(id, dto.items || [], u.tenantId);
  }

  @Delete(':id/items/:iid')
  @RequirePermissions('estimations:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a line item' })
  deleteItem(@Param('id') id: string, @Param('iid') iid: string, @CurrentUser() u: any) {
    return this.svc.deleteItem(id, iid, u.tenantId);
  }

  @Post(':id/version')
  @RequirePermissions('estimations:write')
  @ApiOperation({ summary: 'Create new version from estimation' })
  version(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.createVersion(id, u.tenantId, u.id);
  }

  @Post(':id/lock')
  @RequirePermissions('estimations:approve')
  @ApiOperation({ summary: 'Lock estimation' })
  lock(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.lock(id, u.tenantId, u.id);
  }

  @Post(':id/unlock')
  @RequirePermissions('estimations:approve')
  @ApiOperation({ summary: 'Unlock estimation' })
  unlock(@Param('id') id: string, @CurrentUser() u: any) {
    return this.svc.unlock(id, u.tenantId);
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('projects') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get()             @RequirePermissions('projects:read')   list(@Query() q: any, @CurrentUser() u: any)                              { return this.svc.findAll(u.tenantId, q); }
  @Get('stats')      @RequirePermissions('projects:read')   stats(@CurrentUser() u: any)                                              { return this.svc.getStats(u.tenantId); }
  @Get(':id')        @RequirePermissions('projects:read')   one(@Param('id') id: string, @CurrentUser() u: any)                      { return this.svc.findOne(id, u.tenantId); }
  @Post()            @RequirePermissions('projects:write')  create(@Body() dto: any, @CurrentUser() u: any)                           { return this.svc.create(dto, u.tenantId, u.id); }
  @Patch(':id')      @RequirePermissions('projects:write')  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.update(id, dto, u.tenantId, u.id); }
  @Post(':id/clone') @RequirePermissions('projects:write')  clone(@Param('id') id: string, @CurrentUser() u: any)                    { return this.svc.clone(id, u.tenantId, u.id); }
  @Delete(':id') @RequirePermissions('projects:delete') @HttpCode(HttpStatus.NO_CONTENT)
  del(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.delete(id, u.tenantId, u.id); }
}

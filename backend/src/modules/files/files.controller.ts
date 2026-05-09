import { Controller, Get, Post, Delete, Param, Query, UseGuards, UseInterceptors, UploadedFiles, HttpCode, HttpStatus } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('files') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('files')
export class FilesController {
  constructor(private svc: FilesService) {}

  @Post('upload')
  @RequirePermissions('projects:write')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload project files' })
  upload(@UploadedFiles() files: any[], @Query('projectId') projectId: string, @CurrentUser() u: any) {
    return this.svc.uploadFiles(projectId, u.tenantId, u.id, files || []);
  }

  @Get()           @RequirePermissions('projects:read') list(@Query('projectId') pid: string, @CurrentUser() u: any) { return this.svc.findByProject(pid, u.tenantId); }
  @Get(':id/download') @RequirePermissions('projects:read') dl(@Param('id') id: string, @CurrentUser() u: any)   { return this.svc.getDownloadUrl(id, u.tenantId); }
  @Delete(':id')   @RequirePermissions('projects:write') @HttpCode(HttpStatus.NO_CONTENT)
  del(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.delete(id, u.tenantId); }
}

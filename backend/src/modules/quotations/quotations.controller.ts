import { Controller, Get, Post, Patch, Param, Body, Query, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { QuotationsService } from './quotations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('quotations') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('quotations')
export class QuotationsController {
  constructor(private svc: QuotationsService) {}
  @Get('all') @RequirePermissions('quotations:read') findAll(@CurrentUser() u: any) { return this.svc.findAll(u.tenantId); }
  @Get()      @RequirePermissions('quotations:read') list(@Query('projectId') pid: string, @CurrentUser() u: any) { return this.svc.findByProject(pid, u.tenantId); }
  @Get(':id') @RequirePermissions('quotations:read') one(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.findOne(id, u.tenantId); }
  @Post()     @RequirePermissions('quotations:write') @ApiOperation({ summary: 'Generate AI quotation' }) generate(@Body() dto: any, @CurrentUser() u: any) { return this.svc.generate(dto, u.tenantId, u.id); }
  @Patch(':id') @RequirePermissions('quotations:write') update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.update(id, dto, u.tenantId); }
  @Get(':id/pdf') @RequirePermissions('quotations:read') @ApiOperation({ summary: 'Download PDF' })
  async pdf(@Param('id') id: string, @CurrentUser() u: any, @Res() res: Response) {
    const buf = await this.svc.generatePdf(id, u.tenantId);
    const q   = await this.svc.findOne(id, u.tenantId);
    res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition',`attachment; filename="${q.quoteNumber}.pdf"`); res.send(buf);
  }
  @Post(':id/send') @RequirePermissions('quotations:send') @HttpCode(HttpStatus.NO_CONTENT)
  send(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.sendByEmail(id, dto, u.tenantId); }
}

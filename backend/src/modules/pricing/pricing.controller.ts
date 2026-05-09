import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pricing') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('pricing')
export class PricingController {
  constructor(private svc: PricingService) {}
  @Get()           @RequirePermissions('pricing:read')  list(@Query() q: any, @CurrentUser() u: any)                              { return this.svc.findAll(u.tenantId, q); }
  @Get('categories')@RequirePermissions('pricing:read') cats(@CurrentUser() u: any)                                               { return this.svc.getCategories(u.tenantId); }
  @Get(':id')      @RequirePermissions('pricing:read')  one(@Param('id') id: string, @CurrentUser() u: any)                      { return this.svc.findOne(id, u.tenantId); }
  @Post()          @RequirePermissions('pricing:write') create(@Body() dto: any, @CurrentUser() u: any)                           { return this.svc.create(dto, u.tenantId, u.id); }
  @Patch(':id')    @RequirePermissions('pricing:write') update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.update(id, dto, u.tenantId); }
  @Post('bulk')    @RequirePermissions('pricing:write') bulk(@Body() dto: any, @CurrentUser() u: any)                            { return this.svc.bulkImport(dto.items||[], u.tenantId, u.id); }
  @Delete(':id')   @RequirePermissions('pricing:write') @HttpCode(HttpStatus.NO_CONTENT) del(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.delete(id, u.tenantId); }
}

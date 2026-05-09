import { Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('tenants') @ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}
  @Get()              @RequirePermissions('*')              findAll()                                     { return this.svc.findAll(); }
  @Get(':id')         @RequirePermissions('settings:read')  findOne(@Param('id') id: string)              { return this.svc.findOne(id); }
  @Post()             @RequirePermissions('*')              create(@Body() dto: CreateTenantDto)          { return this.svc.provision(dto); }
  @Patch(':id')       @RequirePermissions('settings:write') update(@Param('id') id: string, @Body() d: any) { return this.svc.update(id, d); }
  @Post(':id/suspend')    @RequirePermissions('*') @HttpCode(HttpStatus.NO_CONTENT) suspend(@Param('id') id: string)    { return this.svc.suspend(id); }
  @Post(':id/reactivate') @RequirePermissions('*')          reactivate(@Param('id') id: string)           { return this.svc.reactivate(id); }
  @Get(':id/usage')   @RequirePermissions('settings:read')  getUsage(@Param('id') id: string)             { return this.svc.getUsage(id); }
}

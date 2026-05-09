import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('users') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get()              @RequirePermissions('users:read')   list(@CurrentUser() u: any)                              { return this.svc.findAll(u.tenantId); }
  @Get('stats')       @RequirePermissions('users:read')   stats(@CurrentUser() u: any)                             { return this.svc.getStats(u.tenantId); }
  @Get('roles')       @RequirePermissions('roles:read')   roles(@CurrentUser() u: any)                             { return this.svc.getRoles(u.tenantId); }
  @Get(':id')         @RequirePermissions('users:read')   one(@Param('id') id: string, @CurrentUser() u: any)      { return this.svc.findOne(id, u.tenantId); }
  @Post()             @RequirePermissions('users:write')  create(@Body() dto: any, @CurrentUser() u: any)           { return this.svc.create(dto, u.tenantId); }
  @Patch(':id')       @RequirePermissions('users:write')  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.update(id, dto, u.tenantId); }
  @Post('invite')     @RequirePermissions('users:write')  invite(@Body() dto: any, @CurrentUser() u: any)           { return this.svc.invite(dto.email, dto.roleId, u.tenantId); }
  @Public() @Post('accept-invite') @ApiOperation({ summary: 'Accept invite' })
  acceptInvite(@Body() dto: any) { return this.svc.acceptInvite(dto.token, dto.password, dto.firstName, dto.lastName); }
  @Post(':id/reactivate') @RequirePermissions('users:write') reactivate(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.reactivate(id, u.tenantId); }
  @Delete(':id') @RequirePermissions('users:delete') @HttpCode(HttpStatus.NO_CONTENT)
  del(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deactivate(id, u.tenantId); }
}

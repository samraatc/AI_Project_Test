import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private svc: AuthService) {}

  @Public() @Post('login') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Login' })
  login(@Body() dto: LoginDto, @Req() req: any) { return this.svc.login(dto, req.ip || '', req.headers['user-agent'] || ''); }

  @Public() @Post('refresh') @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: any) { return this.svc.refreshToken(dto, req.ip || ''); }

  @UseGuards(JwtAuthGuard) @Post('logout') @HttpCode(HttpStatus.NO_CONTENT) @ApiBearerAuth('JWT')
  logout(@CurrentUser() user: any, @Body() dto: RefreshTokenDto) { return this.svc.logout(user.id, dto.refreshToken); }

  @UseGuards(JwtAuthGuard) @Post('logout-all') @HttpCode(HttpStatus.NO_CONTENT) @ApiBearerAuth('JWT')
  logoutAll(@CurrentUser() user: any) { return this.svc.logoutAll(user.id); }

  @UseGuards(JwtAuthGuard) @Get('me') @ApiBearerAuth('JWT') @ApiOperation({ summary: 'Get profile' })
  me(@CurrentUser() user: any) { return this.svc.getProfile(user.id); }

  @UseGuards(JwtAuthGuard) @Patch('password') @ApiBearerAuth('JWT')
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) { return this.svc.changePassword(user.id, dto.currentPassword, dto.newPassword); }
}

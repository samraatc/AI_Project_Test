import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)         private userRepo:   Repository<User>,
    @InjectRepository(RefreshToken) private tokenRepo:  Repository<RefreshToken>,
    @InjectRepository(Tenant)       private tenantRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)     private auditRepo:  Repository<AuditLog>,
    private jwtService: JwtService,
    private cfg: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() }, relations: ['role', 'tenant'] });
    if (!user || user.status !== 'active') return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.tenant?.status === 'suspended') throw new ForbiddenException('Account suspended');
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    const tokens = await this.generateTokenPair(user, ip, userAgent);
    await this.auditRepo.save(this.auditRepo.create({ tenantId: user.tenantId, userId: user.id, action: 'auth.login', ipAddress: ip }));
    return { ...tokens, expiresIn: this.cfg.get('app.jwtExpiry', '15m'), user: this.userToDto(user) };
  }

  async refreshToken(dto: RefreshTokenDto, ip: string): Promise<AuthResponse> {
    const tokenHash = createHash('sha256').update(dto.refreshToken).digest('hex');
    const stored = await this.tokenRepo.findOne({ where: { tokenHash, revoked: false }, relations: ['user', 'user.role', 'user.tenant'] });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.expiresAt < new Date()) { await this.tokenRepo.update(stored.id, { revoked: true }); throw new UnauthorizedException('Refresh token expired'); }
    await this.tokenRepo.update(stored.id, { revoked: true });
    const tokens = await this.generateTokenPair(stored.user, ip, '');
    return { ...tokens, expiresIn: this.cfg.get('app.jwtExpiry', '15m'), user: this.userToDto(stored.user) };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.tokenRepo.update({ userId, tokenHash }, { revoked: true });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw new BadRequestException('Current password is incorrect');
    await this.userRepo.update(userId, { passwordHash: await bcrypt.hash(newPassword, 12) });
    await this.logoutAll(userId);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role', 'tenant'] });
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl, department: user.department, role: user.role?.name, permissions: user.role?.permissions || [], tenantId: user.tenantId, tenantName: user.tenant?.name, tenantSlug: user.tenant?.slug, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt };
  }

  private async generateTokenPair(user: User, ip: string, ua: string) {
    const payload: JwtPayload = { sub: user.id, email: user.email, tenantId: user.tenantId, role: user.role?.name, permissions: user.role?.permissions || [] };
    const accessToken  = this.jwtService.sign(payload);
    const rawRefresh   = randomBytes(64).toString('hex');
    const tokenHash    = createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt    = new Date(); expiresAt.setDate(expiresAt.getDate() + this.cfg.get<number>('app.refreshTokenDays', 30));
    await this.tokenRepo.save(this.tokenRepo.create({ userId: user.id, tokenHash, expiresAt, ipAddress: ip, userAgent: ua }));
    return { accessToken, refreshToken: rawRefresh };
  }

  private userToDto(user: User) {
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role?.name, permissions: user.role?.permissions || [], tenantId: user.tenantId, tenantName: user.tenant?.name, tenantSlug: user.tenant?.slug };
  }
}

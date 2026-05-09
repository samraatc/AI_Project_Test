import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Role } from '../users/entities/role.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Tenant, Role, AuditLog]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (cfg: ConfigService) => ({ secret: cfg.get('app.jwtSecret'), signOptions: { expiresIn: cfg.get('app.jwtExpiry', '15m') } }) }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

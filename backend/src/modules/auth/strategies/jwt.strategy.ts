import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: cfg.get<string>('app.jwtSecret') });
  }
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.tenantId) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, tenantId: payload.tenantId, role: payload.role, permissions: payload.permissions };
  }
}

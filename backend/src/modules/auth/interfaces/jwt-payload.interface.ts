export interface JwtPayload {
  sub: string; email: string; tenantId: string; role: string; permissions: string[];
}

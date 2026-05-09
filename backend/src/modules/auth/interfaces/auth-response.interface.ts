export interface AuthResponse {
  accessToken: string; refreshToken: string; expiresIn: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: string; permissions: string[]; tenantId: string; tenantName: string; tenantSlug: string; };
}

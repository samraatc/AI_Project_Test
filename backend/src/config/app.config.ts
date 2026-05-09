import { registerAs } from '@nestjs/config';
export default registerAs('app', () => ({
  nodeEnv:          process.env.NODE_ENV         || 'development',
  port:             parseInt(process.env.PORT, 10) || 3000,
  jwtSecret:        process.env.JWT_SECRET        || 'dev_secret_CHANGE_IN_PROD',
  jwtExpiry:        process.env.JWT_EXPIRY        || '2h',
  refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS, 10) || 30,
  corsOrigins:      process.env.CORS_ORIGINS      || 'http://localhost:3001',
  redisHost:        process.env.REDIS_HOST        || 'localhost',
  redisPort:        parseInt(process.env.REDIS_PORT, 10) || 6379,
  redisPassword:    process.env.REDIS_PASSWORD    || '',
  maxFileSizeMb:    parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 100,
  frontendUrl:      process.env.FRONTEND_URL      || 'http://localhost:3001',
}));

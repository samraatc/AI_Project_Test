import { registerAs } from '@nestjs/config';
export default registerAs('database', () => ({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'estimateos',
  password: process.env.DB_PASSWORD || 'changeme',
  name:     process.env.DB_NAME     || 'estimateos',
  ssl:      process.env.DB_SSL === 'true',
}));

import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',

  port: process.env.DB_PORT
    ? parseInt(process.env.DB_PORT, 10)
    : 5432,

  username: process.env.DB_USERNAME || 'estimateos',

  password: process.env.DB_PASSWORD || 'changeme',

  database: process.env.DB_NAME || 'estimateos', // ✅ FIXED

  ssl: process.env.DB_SSL === 'true',

  // 🔥 IMPORTANT for Docker stability
  retryAttempts: 10,
  retryDelay: 3000,
}));
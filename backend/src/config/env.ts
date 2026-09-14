import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvironmentConfig {
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NODE_ENV: 'development' | 'production' | 'test';
  CLIENT_URL: string;
}

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const env: EnvironmentConfig = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
};

// CLIENT_URL accepts a comma-separated list so several frontends can be
// trusted at once (e.g. the production Vercel domain plus its preview URLs).
export const clientOrigins: string[] = env.CLIENT_URL
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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
  /** Local mongod bundled with the desktop app. Preferred over the cloud URI. */
  LOCAL_MONGODB_URI?: string;
  /** MongoDB Atlas endpoint used for synchronising an offline install. */
  CLOUD_MONGODB_URI?: string;
  SYNC_ENABLED: boolean;
  SYNC_INTERVAL_SECONDS: number;
  // Optional email delivery, used only by the "forgot password" OTP flow.
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  SMTP_FROM_NAME?: string;
  /** HTTP email API — needed on hosts that block outbound SMTP (Railway). */
  EMAIL_API_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  /** Where reset codes are delivered; falls back to the user's own email. */
  PASSWORD_RESET_EMAIL?: string;
  /** Folder for database backup files. Defaults to <backend>/backups. */
  BACKUP_DIR?: string;
  /** Master switch for the scheduled automatic backup. */
  BACKUP_AUTO_ENABLED: boolean;
  /** Cron expression for the automatic backup (default: every day at 02:00). */
  BACKUP_CRON: string;
  /** How many automatic backups to keep before the oldest are pruned. */
  BACKUP_RETENTION: number;
  /** Master switch for the SaaS subscription lock. Off = never return 402. */
  SUBSCRIPTION_ENFORCED: boolean;
  /** Default grace window (days) applied to newly created organizations. */
  SUBSCRIPTION_DEFAULT_GRACE_DAYS: number;
  /** Length of the trial granted to a freshly created organization. */
  SUBSCRIPTION_DEFAULT_TRIAL_DAYS: number;
  /** Show the pre-expiry warning banner once this many days remain. */
  SUBSCRIPTION_WARN_DAYS: number;
  /**
   * ISO date the desktop build's offline licence expires at. Electron passes
   * this so the local organization's subscription mirrors the signed key.
   */
  DESKTOP_SUBSCRIPTION_ENDS_AT?: string;
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
  LOCAL_MONGODB_URI: process.env.LOCAL_MONGODB_URI,
  CLOUD_MONGODB_URI: process.env.CLOUD_MONGODB_URI,
  SYNC_ENABLED: process.env.SYNC_ENABLED === 'true',
  SYNC_INTERVAL_SECONDS: parseInt(process.env.SYNC_INTERVAL_SECONDS || '60', 10),
  SMTP_HOST: process.env.SMTP_HOST,
  // 465 is implicit TLS; 587 (the usual Gmail/API port) upgrades with STARTTLS.
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
  EMAIL_API_PROVIDER: process.env.EMAIL_API_PROVIDER,
  EMAIL_API_KEY: process.env.EMAIL_API_KEY,
  PASSWORD_RESET_EMAIL: process.env.PASSWORD_RESET_EMAIL,
  BACKUP_DIR: process.env.BACKUP_DIR,
  BACKUP_AUTO_ENABLED: process.env.BACKUP_AUTO_ENABLED
    ? process.env.BACKUP_AUTO_ENABLED !== 'false'
    : true,
  BACKUP_CRON: process.env.BACKUP_CRON || '0 2 * * *',
  BACKUP_RETENTION: parseInt(process.env.BACKUP_RETENTION || '7', 10),
  SUBSCRIPTION_ENFORCED: process.env.SUBSCRIPTION_ENFORCED
    ? process.env.SUBSCRIPTION_ENFORCED !== 'false'
    : true,
  SUBSCRIPTION_DEFAULT_GRACE_DAYS: parseInt(process.env.SUBSCRIPTION_DEFAULT_GRACE_DAYS || '7', 10),
  SUBSCRIPTION_DEFAULT_TRIAL_DAYS: parseInt(process.env.SUBSCRIPTION_DEFAULT_TRIAL_DAYS || '14', 10),
  SUBSCRIPTION_WARN_DAYS: parseInt(process.env.SUBSCRIPTION_WARN_DAYS || '15', 10),
  DESKTOP_SUBSCRIPTION_ENDS_AT: process.env.DESKTOP_SUBSCRIPTION_ENDS_AT,
};

// CLIENT_URL accepts a comma-separated list so several frontends can be
// trusted at once (e.g. the production Vercel domain plus its preview URLs).
export const clientOrigins: string[] = env.CLIENT_URL
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

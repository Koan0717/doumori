import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { doumoriPool: Pool | undefined };

const connectionString =
  process.env.DOUMORI_DATABASE_URL || process.env.DATABASE_URL;

const getSslOption = (url?: string) => {
  if (!url) return false;
  if (
    url.includes('supabase') ||
    url.includes('postgres.database.azure.com') ||
    url.includes('render.com') ||
    url.includes('neon.tech')
  ) {
    return { rejectUnauthorized: false };
  }
  return false;
};

export const pool =
  globalForDb.doumoriPool ??
  new Pool({
    connectionString,
    ssl: getSslOption(connectionString),
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.doumoriPool = pool;
}

// このダッシュボードが管理する単一サーバーのGuild ID
export const GUILD_ID = process.env.DASHBOARD_GUILD_ID || process.env.SYNC_GUILD_ID || '0';

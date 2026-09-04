import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    // Railway injects DATABASE_URL automatically when Postgres plugin is added.
    // Fall back to individual host/user/pass vars for other environments.
    const connectionConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.SQL_HOST || process.env.PGHOST,
          user: process.env.SQL_USER || process.env.PGUSER,
          password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
          database: process.env.SQL_DB_NAME || process.env.PGDATABASE,
          port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
        };

    global._postgresPool = new Pool({
      ...connectionConfig,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });


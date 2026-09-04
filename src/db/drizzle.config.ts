import { defineConfig } from 'drizzle-kit';

const sqlHost = process.env.SQL_HOST || process.env.PGHOST || '127.0.0.1';
const sqlDbName = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres';
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.PGUSER || 'postgres';
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.PGPASSWORD || 'postgres';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: sqlHost,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  }
});


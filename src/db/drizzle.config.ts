import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.SQL_HOST || process.env.PGHOST || "127.0.0.1",
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
        user:
          process.env.SQL_ADMIN_USER ||
          process.env.SQL_USER ||
          process.env.PGUSER ||
          "postgres",
        password:
          process.env.SQL_ADMIN_PASSWORD ||
          process.env.SQL_PASSWORD ||
          process.env.PGPASSWORD ||
          "postgres",
        database:
          process.env.SQL_DB_NAME || process.env.PGDATABASE || "postgres",
        ssl: false,
      },
});

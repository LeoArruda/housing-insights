import { openDatabase } from "./db/database.ts";
import { migrationsDirectory, runMigrations } from "./db/migrate.ts";
import { loadEnv } from "./env.ts";
import { createApp } from "./server/app.ts";

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);
runMigrations(db, migrationsDirectory());

const app = createApp(db, env);

console.info(
  `Listening on http://${env.HOST}:${env.PORT} (database: ${env.DATABASE_PATH})`,
);

Bun.serve({
  hostname: env.HOST,
  port: env.PORT,
  fetch: app.fetch,
});

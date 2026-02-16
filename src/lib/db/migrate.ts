import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log("[DB] Running migrations...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[DB] Migrations complete.");
  } catch (error) {
    console.error("[DB] Migration error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run when invoked directly
runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});

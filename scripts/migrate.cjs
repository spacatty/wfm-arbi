"use strict";
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const path = require("path");

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[DB] DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("[DB] Running migrations...");
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
    console.log("[DB] Migrations complete.");
  } catch (err) {
    console.error("[DB] Migration error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

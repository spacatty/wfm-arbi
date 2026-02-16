import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("Tables in DB:");
  for (const row of res.rows) {
    console.log("  " + row.tablename);
  }

  // Check drizzle migration table structure
  try {
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '__drizzle_migrations' ORDER BY ordinal_position"
    );
    console.log("\n__drizzle_migrations columns:");
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} (${c.data_type})`);
    }

    const rows = await pool.query("SELECT * FROM __drizzle_migrations ORDER BY id");
    console.log("\n__drizzle_migrations rows:");
    for (const r of rows.rows) {
      console.log(`  ${JSON.stringify(r)}`);
    }
  } catch (e: any) {
    console.log("\n__drizzle_migrations does not exist:", e.message);
  }

  await pool.end();
}

main().catch(console.error);

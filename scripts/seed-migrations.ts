import "dotenv/config";
import { Pool } from "pg";

/**
 * Drizzle migrator stores its tracking table in the "drizzle" schema,
 * NOT "public". It uses: drizzle.__drizzle_migrations
 *
 * The migrator logic: selects the last entry (ORDER BY created_at DESC LIMIT 1),
 * then for each migration, if lastDbMigration.created_at < migration.folderMillis,
 * it runs the migration. So we need one entry where created_at >= the highest
 * folderMillis value from the journal.
 */
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Drizzle uses the "drizzle" schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);

  // Drop any stale public-schema table from previous attempts
  await pool.query(`DROP TABLE IF EXISTS "public"."__drizzle_migrations"`);

  // Create the table in the correct schema
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `);

  // Truncate in case of prior partial inserts
  await pool.query(`TRUNCATE "drizzle"."__drizzle_migrations"`);
  console.log("[OK] Created drizzle.__drizzle_migrations table");

  // These timestamps must match the "when" values from drizzle/meta/_journal.json
  const migrations = [
    { tag: "0000_handy_zarek",            when: 1770728954473 },
    { tag: "0001_medical_vin_gonzales",   when: 1770757287594 },
    { tag: "0002_old_alice",              when: 1770760505115 },
    { tag: "0003_lowly_omega_flight",     when: 1770772783378 },
    { tag: "0004_simple_layla_miller",    when: 1770774531201 },
    { tag: "0005_mixed_the_liberteens",   when: 1770776073123 },
  ];

  for (const m of migrations) {
    await pool.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [m.tag, m.when]
    );
    console.log(`[OK] ${m.tag} (${m.when})`);
  }

  const res = await pool.query(
    `SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY created_at`
  );
  console.log("\nMigration journal (drizzle schema):");
  for (const row of res.rows) {
    console.log(`  ${row.id}: ${row.hash} @ ${row.created_at}`);
  }

  await pool.end();
}

main().catch(console.error);

import "./load-env";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL (or POSTGRES_URL) is required");
const pool = new Pool({ connectionString, ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false } });

async function main() {
  await pool.query("create table if not exists _app_migrations (name text primary key, applied_at timestamptz not null default now())");
  const directory = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await pool.query("select 1 from _app_migrations where name=$1", [file]);
    if (exists.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(await readFile(path.join(directory, file), "utf8"));
      await client.query("insert into _app_migrations(name) values($1)", [file]);
      await client.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }
}

main().finally(() => pool.end());

import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __handoffPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("DATABASE_URL (or POSTGRES_URL) is not configured");
  return new Pool({
    connectionString,
    // Supabase recommends one application-side connection per warm serverless instance.
    max: process.env.NODE_ENV === "production" ? 1 : 10,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

function getPool() {
  if (global.__handoffPool) return global.__handoffPool;
  const pool = createPool();
  if (process.env.NODE_ENV !== "production") global.__handoffPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

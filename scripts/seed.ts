import "./load-env.ts";
import { hash } from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL (or POSTGRES_URL) is required");
const pool = new Pool({ connectionString, ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false } });

const ids = {
  workspace: "10000000-0000-4000-8000-000000000001",
  coordinator: "20000000-0000-4000-8000-000000000001",
  interviewer: "20000000-0000-4000-8000-000000000002",
  coordinatorMember: "30000000-0000-4000-8000-000000000001",
  interviewerMember: "30000000-0000-4000-8000-000000000002",
};

async function main() {
  const coordinatorUsername = process.env.SEED_COORDINATOR_USERNAME ?? "coordinator";
  const interviewerUsername = process.env.SEED_INTERVIEWER_USERNAME ?? "interviewer";
  const coordinatorPassword = process.env.SEED_COORDINATOR_PASSWORD ?? "ChangeMe-Coordinator-2026!";
  const interviewerPassword = process.env.SEED_INTERVIEWER_PASSWORD ?? "ChangeMe-Interviewer-2026!";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`insert into workspaces(id,name,timezone) values($1,'Interview Workspace','America/New_York') on conflict(id) do update set name=excluded.name`, [ids.workspace]);
    await client.query(`insert into users(id,username,display_name,password_hash) values($1,$2,'Coordinator',$3) on conflict(id) do update set username=excluded.username, display_name=excluded.display_name, password_hash=excluded.password_hash`, [ids.coordinator, coordinatorUsername, await hash(coordinatorPassword, 12)]);
    await client.query(`insert into users(id,username,display_name,password_hash) values($1,$2,'Interviewer',$3) on conflict(id) do update set username=excluded.username, display_name=excluded.display_name, password_hash=excluded.password_hash`, [ids.interviewer, interviewerUsername, await hash(interviewerPassword, 12)]);
    await client.query(`insert into workspace_members(id,workspace_id,user_id,role) values($1,$2,$3,'COORDINATOR') on conflict(id) do nothing`, [ids.coordinatorMember, ids.workspace, ids.coordinator]);
    await client.query(`insert into workspace_members(id,workspace_id,user_id,role) values($1,$2,$3,'INTERVIEWER') on conflict(id) do nothing`, [ids.interviewerMember, ids.workspace, ids.interviewer]);
    await client.query("commit");
    console.log(`Seed complete. Empty workspace ready. Coordinator: ${coordinatorUsername}; Interviewer: ${interviewerUsername}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

main().finally(() => pool.end());

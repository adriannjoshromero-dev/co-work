import "./load-env";
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
    await client.query(`insert into workspaces(id,name,timezone) values($1,'Acorn Interview Team','America/New_York') on conflict(id) do update set name=excluded.name`, [ids.workspace]);
    await client.query(`insert into users(id,username,display_name,password_hash) values($1,$2,'Maya Coordinator',$3) on conflict(id) do update set username=excluded.username, password_hash=excluded.password_hash`, [ids.coordinator, coordinatorUsername, await hash(coordinatorPassword, 12)]);
    await client.query(`insert into users(id,username,display_name,password_hash) values($1,$2,'Jamie Interviewer',$3) on conflict(id) do update set username=excluded.username, password_hash=excluded.password_hash`, [ids.interviewer, interviewerUsername, await hash(interviewerPassword, 12)]);
    await client.query(`insert into workspace_members(id,workspace_id,user_id,role) values($1,$2,$3,'COORDINATOR') on conflict(id) do nothing`, [ids.coordinatorMember, ids.workspace, ids.coordinator]);
    await client.query(`insert into workspace_members(id,workspace_id,user_id,role) values($1,$2,$3,'INTERVIEWER') on conflict(id) do nothing`, [ids.interviewerMember, ids.workspace, ids.interviewer]);

    const base = [ids.workspace, ids.coordinatorMember, ids.interviewerMember];
    await client.query(`
      insert into interviews(id,workspace_id,scheduled_at,duration_minutes,meeting_url,resume_key,resume_url,resume_name,resume_size,resume_mime_type,job_description_html,status,interviewer_confirmed_at,interviewer_confirmed_by,feedback,feedback_submitted_at,feedback_confirmed_at,feedback_confirmed_by,created_by)
      values
      ('40000000-0000-4000-8000-000000000001',$1,date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York' + interval '1 day 10 hours',45,'https://meet.google.com/example-one','seed-alex','https://utfs.io/f/seed-alex','Alex_Chen_Resume.pdf',248000,'application/pdf','<h2>Product Designer</h2><p>We are looking for a thoughtful designer who can turn messy workflows into calm, useful products.</p><ul><li>Portfolio discussion</li><li>Systems thinking</li><li>Collaboration</li></ul>','UPCOMING',null,null,null,null,null,null,$2),
      ('40000000-0000-4000-8000-000000000002',$1,now() + interval '3 hours',60,'https://zoom.us/j/123456789','seed-sam','https://utfs.io/f/seed-sam','Sam_Rivera_Resume.docx',192000,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','<h2>Senior Engineer</h2><p>Focus on pragmatic architecture, communication, and reliable delivery.</p><ul><li>System design</li><li>Technical tradeoffs</li></ul>','UPCOMING',now() - interval '1 hour',$3,null,null,null,null,$2),
      ('40000000-0000-4000-8000-000000000003',$1,now() - interval '3 days',45,'https://meet.google.com/example-done','seed-priya','https://utfs.io/f/seed-priya','Priya_Patel_Resume.pdf',301000,'application/pdf','<h2>Customer Success Lead</h2><p>Discuss leadership, customer empathy, and operational rigor.</p>','DONE',now() - interval '5 days',$3,'Strong customer instincts and clear examples. Recommend moving forward.',now() - interval '3 days',null,null,$2),
      ('40000000-0000-4000-8000-000000000004',$1,now() - interval '8 days',30,'https://meet.google.com/example-canceled','seed-morgan','https://utfs.io/f/seed-morgan','Morgan_Lee_Resume.doc',166000,'application/msword','<h2>Operations Associate</h2><p>Structured problem solving and ownership.</p>','CANCELED',now() - interval '10 days',$3,'Candidate withdrew before the conversation.',now() - interval '8 days',now() - interval '7 days',$2,$2),
      ('40000000-0000-4000-8000-000000000005',$1,now() - interval '15 days',60,'https://zoom.us/j/987654321','seed-taylor','https://utfs.io/f/seed-taylor','Taylor_Jones_Resume.pdf',280000,'application/pdf','<h2>Engineering Manager</h2><p>People leadership, delivery, and healthy team systems.</p>','FAILED',now() - interval '17 days',$3,'Good technical depth, but the people-management examples did not meet the bar for this role.',now() - interval '15 days',now() - interval '14 days',$2,$2),
      ('40000000-0000-4000-8000-000000000006',$1,now() - interval '20 days',45,'https://meet.google.com/example-old','seed-riley','https://utfs.io/f/seed-riley','Riley_Kim_Resume.pdf',219000,'application/pdf','<h2>UX Researcher</h2><p>Original schedule, preserved for reschedule history.</p>','RESCHEDULED',now() - interval '22 days',$3,'Moved at the candidate’s request.',now() - interval '20 days',now() - interval '19 days',$2,$2),
      ('40000000-0000-4000-8000-000000000007',$1,now() + interval '5 days',45,'https://meet.google.com/example-new','seed-riley','https://utfs.io/f/seed-riley','Riley_Kim_Resume.pdf',219000,'application/pdf','<h2>UX Researcher</h2><p>Explore mixed-method research and stakeholder influence.</p>','UPCOMING',null,null,null,null,null,null,$2)
      on conflict(id) do nothing
    `, base);
    await client.query(`update interviews set rescheduled_from_interview_id='40000000-0000-4000-8000-000000000006' where id='40000000-0000-4000-8000-000000000007' and rescheduled_from_interview_id is null`);
    await client.query("commit");
    console.log(`Seed complete. Coordinator: ${coordinatorUsername}; Interviewer: ${interviewerUsername}`);
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
main().finally(() => pool.end());

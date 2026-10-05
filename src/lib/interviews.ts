import "server-only";
import type { PoolClient } from "pg";
import { query } from "./db";
import { AppError } from "./errors";
import type { Interview, InterviewStatus, ResumeFile, SessionUser } from "./types";

type InterviewRow = {
  id: string; workspace_id: string; scheduled_at: Date; duration_minutes: number; meeting_url: string;
  resume_key: string; resume_url: string; resume_name: string; resume_size: number; resume_mime_type: string;
  job_description_html: string; status: InterviewStatus; interviewer_confirmed_at: Date | null;
  interviewer_confirmed_by_name: string | null; feedback: string | null; feedback_submitted_at: Date | null;
  feedback_confirmed_at: Date | null; feedback_confirmed_by_name: string | null;
  rescheduled_from_interview_id: string | null; version: number; created_at: Date; updated_at: Date;
};

const selectColumns = `
  i.id, i.workspace_id, i.scheduled_at, i.duration_minutes, i.meeting_url,
  i.resume_key, i.resume_url, i.resume_name, i.resume_size, i.resume_mime_type,
  i.job_description_html, i.status, i.interviewer_confirmed_at,
  confirmer.display_name as interviewer_confirmed_by_name,
  i.feedback, i.feedback_submitted_at, i.feedback_confirmed_at,
  feedback_confirmer.display_name as feedback_confirmed_by_name,
  i.rescheduled_from_interview_id, i.version, i.created_at, i.updated_at
`;
const joins = `
  left join workspace_members confirm_member on confirm_member.id = i.interviewer_confirmed_by
  left join users confirmer on confirmer.id = confirm_member.user_id
  left join workspace_members feedback_member on feedback_member.id = i.feedback_confirmed_by
  left join users feedback_confirmer on feedback_confirmer.id = feedback_member.user_id
`;

function mapInterview(row: InterviewRow): Interview {
  return {
    id: row.id, workspaceId: row.workspace_id, scheduledAt: row.scheduled_at.toISOString(),
    durationMinutes: row.duration_minutes, meetingUrl: row.meeting_url,
    resume: { key: row.resume_key, url: row.resume_url, name: row.resume_name, size: row.resume_size, mimeType: row.resume_mime_type },
    jobDescriptionHtml: row.job_description_html, status: row.status,
    interviewerConfirmedAt: row.interviewer_confirmed_at?.toISOString() ?? null,
    interviewerConfirmedByName: row.interviewer_confirmed_by_name,
    feedback: row.feedback, feedbackSubmittedAt: row.feedback_submitted_at?.toISOString() ?? null,
    feedbackConfirmedAt: row.feedback_confirmed_at?.toISOString() ?? null,
    feedbackConfirmedByName: row.feedback_confirmed_by_name,
    rescheduledFromInterviewId: row.rescheduled_from_interview_id,
    version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  };
}

export async function listInterviews(workspaceId: string) {
  const result = await query<InterviewRow>(
    `select ${selectColumns} from interviews i ${joins} where i.workspace_id = $1 order by i.scheduled_at asc`,
    [workspaceId],
  );
  return result.rows.map(mapInterview);
}

export async function getResumeUrl(workspaceId: string, interviewId: string) {
  const result = await query<{ resume_url: string }>(
    "select resume_url from interviews where id=$1 and workspace_id=$2 limit 1",
    [interviewId, workspaceId],
  );
  if (!result.rows[0]) throw new AppError(404, "Resume not found.");
  return result.rows[0].resume_url;
}

type InterviewInput = {
  scheduledAt: string; durationMinutes: number; meetingUrl: string; resume: ResumeFile;
  jobDescriptionHtml: string; rescheduledFromInterviewId?: string | null;
};

export async function createInterview(user: SessionUser, input: InterviewInput) {
  if (input.rescheduledFromInterviewId) {
    const original = await query("select 1 from interviews where id = $1 and workspace_id = $2 and status = 'RESCHEDULED'", [input.rescheduledFromInterviewId, user.workspaceId]);
    if (!original.rowCount) throw new AppError(400, "The original interview must be marked Rescheduled first.");
  }
  await query(`
    insert into interviews (workspace_id, scheduled_at, duration_minutes, meeting_url,
      resume_key, resume_url, resume_name, resume_size, resume_mime_type,
      job_description_html, rescheduled_from_interview_id, created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
  `, [user.workspaceId, input.scheduledAt, input.durationMinutes, input.meetingUrl,
    input.resume.key, input.resume.url, input.resume.name, input.resume.size, input.resume.mimeType,
    input.jobDescriptionHtml, input.rescheduledFromInterviewId ?? null, user.memberId]);
}

export async function updateInterview(user: SessionUser, id: string, input: InterviewInput & { expectedVersion: number }) {
  const result = await query(`
    update interviews set scheduled_at=$1, duration_minutes=$2, meeting_url=$3,
      resume_key=$4, resume_url=$5, resume_name=$6, resume_size=$7, resume_mime_type=$8,
      job_description_html=$9, rescheduled_from_interview_id=$10, version=version+1, updated_at=now()
    where id=$11 and workspace_id=$12 and interviewer_confirmed_at is null and version=$13
  `, [input.scheduledAt, input.durationMinutes, input.meetingUrl, input.resume.key, input.resume.url,
    input.resume.name, input.resume.size, input.resume.mimeType, input.jobDescriptionHtml,
    input.rescheduledFromInterviewId ?? null, id, user.workspaceId, input.expectedVersion]);
  if (!result.rowCount) throw new AppError(409, "This interview changed or was confirmed while you were editing. Refresh and review it.", "STALE_OR_LOCKED");
}

export async function deleteInterview(user: SessionUser, id: string, expectedVersion: number) {
  const result = await query(
    "delete from interviews where id=$1 and workspace_id=$2 and interviewer_confirmed_at is null and version=$3",
    [id, user.workspaceId, expectedVersion],
  );
  if (!result.rowCount) throw new AppError(409, "This interview changed or was confirmed and can no longer be deleted.", "STALE_OR_LOCKED");
}

export async function confirmInterview(user: SessionUser, id: string, expectedVersion: number) {
  const result = await query(`
    update interviews set interviewer_confirmed_at=now(), interviewer_confirmed_by=$1,
      version=version+1, updated_at=now()
    where id=$2 and workspace_id=$3 and interviewer_confirmed_at is null and version=$4
  `, [user.memberId, id, user.workspaceId, expectedVersion]);
  if (!result.rowCount) throw new AppError(409, "This interview was already confirmed or changed. Refresh to see the latest version.", "STALE_OR_LOCKED");
}

export async function saveFeedback(user: SessionUser, id: string, status: InterviewStatus, feedback: string, expectedVersion: number) {
  const result = await query(`
    update interviews set status=$1, feedback=$2, feedback_submitted_at=now(),
      version=version+1, updated_at=now()
    where id=$3 and workspace_id=$4 and interviewer_confirmed_at is not null
      and feedback_confirmed_at is null and version=$5
  `, [status, feedback, id, user.workspaceId, expectedVersion]);
  if (!result.rowCount) throw new AppError(409, "This interview changed or its feedback was confirmed. Your update was not applied.", "STALE_OR_LOCKED");
}

export async function confirmFeedback(user: SessionUser, id: string, expectedVersion: number) {
  const result = await query(`
    update interviews set feedback_confirmed_at=now(), feedback_confirmed_by=$1,
      version=version+1, updated_at=now()
    where id=$2 and workspace_id=$3 and feedback is not null
      and status <> 'UPCOMING' and feedback_confirmed_at is null and version=$4
  `, [user.memberId, id, user.workspaceId, expectedVersion]);
  if (!result.rowCount) throw new AppError(409, "This feedback changed or was already confirmed. Refresh and review it again.", "STALE_OR_LOCKED");
}

export async function updateWorkspaceTimezone(user: SessionUser, timezone: string) {
  const result = await query("update workspaces set timezone=$1, updated_at=now() where id=$2", [timezone, user.workspaceId]);
  if (!result.rowCount) throw new AppError(404, "Workspace not found.");
}

// Kept exported for targeted integration tests and future multi-step reschedule operations.
export async function lockInterviewForUpdate(client: PoolClient, workspaceId: string, id: string) {
  return client.query("select * from interviews where id=$1 and workspace_id=$2 for update", [id, workspaceId]);
}

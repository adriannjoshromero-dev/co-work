create extension if not exists pgcrypto;

create type app_role as enum ('COORDINATOR', 'INTERVIEWER');
create type interview_status as enum ('UPCOMING', 'DONE', 'CANCELED', 'FAILED', 'RESCHEDULED');

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[A-Za-z0-9_.-]{2,80}$')
);
create unique index users_username_lower_key on users (lower(username));

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members(user_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expires_idx on sessions(expires_at);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 10 and 480),
  meeting_url text not null,
  resume_key text not null,
  resume_url text not null,
  resume_name text not null,
  resume_size integer not null check (resume_size > 0 and resume_size <= 8388608),
  resume_mime_type text not null check (resume_mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  job_description_html text not null,
  status interview_status not null default 'UPCOMING',
  interviewer_confirmed_at timestamptz,
  interviewer_confirmed_by uuid references workspace_members(id),
  feedback text,
  feedback_submitted_at timestamptz,
  feedback_confirmed_at timestamptz,
  feedback_confirmed_by uuid references workspace_members(id),
  rescheduled_from_interview_id uuid references interviews(id),
  created_by uuid not null references workspace_members(id),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_confirmation_pair check (
    (interviewer_confirmed_at is null and interviewer_confirmed_by is null) or
    (interviewer_confirmed_at is not null and interviewer_confirmed_by is not null)
  ),
  constraint feedback_submission_pair check (
    (feedback is null and feedback_submitted_at is null) or
    (feedback is not null and feedback_submitted_at is not null)
  ),
  constraint feedback_confirmation_pair check (
    (feedback_confirmed_at is null and feedback_confirmed_by is null) or
    (feedback_confirmed_at is not null and feedback_confirmed_by is not null)
  ),
  constraint confirmed_feedback_requires_feedback check (feedback_confirmed_at is null or feedback is not null),
  constraint feedback_requires_final_status check (feedback is null or status <> 'UPCOMING')
);
create index interviews_workspace_schedule_idx on interviews(workspace_id, scheduled_at);
create index interviews_workspace_status_idx on interviews(workspace_id, status);
create index interviews_feedback_queue_idx on interviews(workspace_id, feedback_submitted_at)
  where feedback_submitted_at is not null and feedback_confirmed_at is null;

-- Database triggers are a second line of defense. They make both permanent locks
-- hold even if a future code path performs a direct UPDATE or DELETE.
create or replace function enforce_interview_locks() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.interviewer_confirmed_at is not null then
      raise exception 'Confirmed interviews cannot be deleted' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.interviewer_confirmed_at is not null and (
    new.scheduled_at is distinct from old.scheduled_at or
    new.duration_minutes is distinct from old.duration_minutes or
    new.meeting_url is distinct from old.meeting_url or
    new.resume_key is distinct from old.resume_key or
    new.resume_url is distinct from old.resume_url or
    new.resume_name is distinct from old.resume_name or
    new.resume_size is distinct from old.resume_size or
    new.resume_mime_type is distinct from old.resume_mime_type or
    new.job_description_html is distinct from old.job_description_html or
    new.rescheduled_from_interview_id is distinct from old.rescheduled_from_interview_id
  ) then
    raise exception 'Confirmed interview details are permanently locked' using errcode = 'P0001';
  end if;

  if old.interviewer_confirmed_at is not null and (
    new.interviewer_confirmed_at is distinct from old.interviewer_confirmed_at or
    new.interviewer_confirmed_by is distinct from old.interviewer_confirmed_by
  ) then
    raise exception 'Interview confirmation is permanent' using errcode = 'P0001';
  end if;

  if old.feedback_confirmed_at is not null and (
    new.feedback is distinct from old.feedback or
    new.status is distinct from old.status or
    new.feedback_confirmed_at is distinct from old.feedback_confirmed_at or
    new.feedback_confirmed_by is distinct from old.feedback_confirmed_by
  ) then
    raise exception 'Confirmed feedback and final status are permanently locked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger interviews_permanent_locks
before update or delete on interviews
for each row execute function enforce_interview_locks();

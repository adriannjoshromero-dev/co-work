-- Remove only the fixed records created by the original demo seed.
-- Real interviews use generated UUIDs and are intentionally preserved.
drop trigger if exists interviews_permanent_locks on interviews;

delete from interviews
where id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000007'
);

create trigger interviews_permanent_locks
before update or delete on interviews
for each row execute function enforce_interview_locks();

update workspaces
set name = 'Interview Workspace', updated_at = now()
where id = '10000000-0000-4000-8000-000000000001';

update users
set display_name = 'Coordinator', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';

update users
set display_name = 'Interviewer', updated_at = now()
where id = '20000000-0000-4000-8000-000000000002';

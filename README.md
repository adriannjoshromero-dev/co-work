# Handoff

Handoff is a private interview workspace for Coordinators and Interviewers. The Coordinator schedules and prepares the interview; the Interviewer opens one dashboard, sees what is next, conducts it, and returns a final status and note.

## Architecture

- **Next.js 16 App Router + React 19 + TypeScript** — UI, server-rendered dashboard, and protected route handlers
- **Supabase PostgreSQL** — users, workspace membership, sessions, interviews, feedback, and locking metadata
- **UploadThing** — resume file bytes; PostgreSQL stores only the file reference and metadata
- **Vercel** — application hosting
- **Zod** — request validation; `sanitize-html` — safe rich-text persistence

The core tables are `users`, `workspaces`, `workspace_members`, `sessions`, and `interviews`. Every mutation includes the authenticated workspace ID. V1 selects the user's first workspace membership; the relational model supports more members and workspaces without changing interview ownership.

### Lock guarantees

The application does not rely on disabled buttons for integrity.

1. API mutations verify the server session, workspace membership, and required role.
2. Mutations use `WHERE version = expectedVersion` for optimistic concurrency.
3. Detail edits/deletes additionally require `interviewer_confirmed_at IS NULL`.
4. Feedback/status edits additionally require `feedback_confirmed_at IS NULL`.
5. A PostgreSQL trigger independently rejects changes to confirmed details, removal of either confirmation, and changes to confirmed feedback/status.

Sessions use 256-bit random opaque tokens. Only a SHA-256 digest is stored in PostgreSQL; cookies are HttpOnly, SameSite=Lax, and Secure in production. Passwords are bcrypt-hashed with cost 12. Mutation routes enforce same-origin requests.

## Local setup

Requirements: Node.js 22+ and a Supabase project (or local PostgreSQL for development).

1. Copy `.env.example` to `.env.local`; fill in `DATABASE_URL` and `UPLOADTHING_TOKEN`.
2. For local development and migrations, copy the Supabase **Session pooler** URL (port `5432`) from the project's **Connect** dialog. Use the **Transaction pooler** URL (port `6543`) for Vercel. A regular local `postgresql://` URL also works.
3. Install and initialize:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

4. Open `http://localhost:3000` and use the seeded usernames/passwords from your environment.

The migration and seed scripts load `.env.local` automatically. `DATABASE_URL` is preferred, while the Vercel Marketplace-provided `POSTGRES_URL` is also supported. The migration runner records applied files in `_app_migrations`. The canonical SQL lives in `supabase/migrations`, so `supabase db push` is also supported. The seed is idempotent for its fixed demo records. Set all four `SEED_*` values before seeding any shared environment. Seed resume URLs are illustrative; new uploads are real UploadThing objects.

## Resume uploads

The `/api/uploadthing` route authenticates the Coordinator before issuing an upload. It accepts one PDF, DOC, or DOCX up to 8 MB. UploadThing stores the bytes; the key, URL, original name, size, and MIME type are validated again when the interview is saved. The app requires an authenticated workspace member before redirecting to the stored resume URL. Files use UploadThing's free-tier-compatible `public-read` ACL, so anyone who obtains a raw storage URL can access that file; use private ACLs and signed URLs if the workspace later moves to a paid UploadThing tier.

Deleting an unconfirmed interview removes the database record but does not delete the storage object. Configure an UploadThing orphan-retention process according to your organization's policy.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover roles, both permanent locks, stale-version rejection, feedback ownership, final-status locking, workspace timezone grouping, DST conversion, and countdown states. Run migrations against a disposable Supabase branch for a full database integration check.

## Deploy to Vercel

1. Push this repository and import it into Vercel as a Next.js project.
2. Add `DATABASE_URL` and `UPLOADTHING_TOKEN` in Project Settings → Environment Variables. Use the Supabase Transaction pooler URL for `DATABASE_URL`. If Supabase's Vercel Marketplace integration already created `POSTGRES_URL`, the application can use that directly instead.
3. Apply migrations once from a trusted machine or CI with `npm run db:migrate`. Seed only if desired and only with production-safe credentials.
4. Deploy; no Vercel filesystem storage is used.
5. Confirm the production callback URL and allowed origin in UploadThing.

For production operations, rotate seed passwords, enable appropriate Supabase backups/PITR, keep database credentials server-only, and validate migrations against a branch before production.

## Product behavior

- Schedules are `timestamptz` (UTC internally). Display, date grouping, and date-input conversion use the workspace's IANA timezone, including DST.
- Passing the scheduled time never changes status; only the Interviewer chooses a final status.
- Rescheduled records remain historical. Mark the original `RESCHEDULED`, then create a replacement linked by `rescheduled_from_interview_id` (supported by the schema/API; omitted from the fast V1 form).
- Rich text is allowlist-sanitized on the server; external links get safe `target`/`rel` attributes.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import { AppError } from "./errors";
import type { SessionUser } from "./types";
import { roleAllowed } from "./rules";

const COOKIE_NAME = "handoff_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function authenticate(username: string, password: string) {
  const result = await query<{ id: string; password_hash: string }>(
    "select id, password_hash from users where lower(username) = lower($1) limit 1",
    [username],
  );
  const user = result.rows[0];
  if (!user || !(await compare(password, user.password_hash))) {
    throw new AppError(401, "That username or password doesn’t match.", "INVALID_CREDENTIALS");
  }
  return user.id;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await query("insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)", [
    userId,
    hashToken(token),
    expiresAt,
  ]);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await query<{
    id: string; username: string; display_name: string; workspace_id: string;
    workspace_name: string; timezone: string; member_id: string; role: SessionUser["role"];
  }>(`
    select u.id, u.username, u.display_name, w.id as workspace_id, w.name as workspace_name,
      w.timezone, wm.id as member_id, wm.role
    from sessions s
    join users u on u.id = s.user_id
    join workspace_members wm on wm.user_id = u.id
    join workspaces w on w.id = wm.workspace_id
    where s.token_hash = $1 and s.expires_at > now()
    order by wm.created_at asc limit 1
  `, [hashToken(token)]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id, username: row.username, displayName: row.display_name,
    workspaceId: row.workspace_id, workspaceName: row.workspace_name,
    timezone: row.timezone, memberId: row.member_id, role: row.role,
  };
}

export async function requireUser(role?: SessionUser["role"]) {
  const user = await getSessionUser();
  if (!user) throw new AppError(401, "Please sign in again.", "UNAUTHENTICATED");
  if (!roleAllowed(user.role, role)) throw new AppError(403, "You don’t have permission to do that.", "FORBIDDEN");
  return user;
}

export async function requirePageUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function verifyMutationOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");
  if (!origin || !host) return;
  const originUrl = new URL(origin);
  if (originUrl.host !== host) throw new AppError(403, "Invalid request origin.", "CSRF");
}

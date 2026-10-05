import type { InterviewStatus, Role } from "./types";

export type LockState = {
  role: Role;
  version: number;
  expectedVersion: number;
  interviewerConfirmedAt: string | null;
  feedback: string | null;
  feedbackConfirmedAt: string | null;
  status: InterviewStatus;
};

export function canEditInterview(state: Pick<LockState, "role" | "interviewerConfirmedAt">) {
  return state.role === "COORDINATOR" && !state.interviewerConfirmedAt;
}
export const canDeleteInterview = canEditInterview;
export function canConfirmInterview(state: Pick<LockState, "role" | "interviewerConfirmedAt">) {
  return state.role === "INTERVIEWER" && !state.interviewerConfirmedAt;
}
export function canEditFeedback(state: Pick<LockState, "role" | "interviewerConfirmedAt" | "feedbackConfirmedAt">) {
  return state.role === "INTERVIEWER" && !!state.interviewerConfirmedAt && !state.feedbackConfirmedAt;
}
export function canConfirmFeedback(state: Pick<LockState, "role" | "feedback" | "feedbackConfirmedAt" | "status">) {
  return state.role === "COORDINATOR" && !!state.feedback && !state.feedbackConfirmedAt && state.status !== "UPCOMING";
}
export function isFresh(state: Pick<LockState, "version" | "expectedVersion">) {
  return state.version === state.expectedVersion;
}
export function roleAllowed(actual: Role, required?: Role) {
  return !required || actual === required;
}

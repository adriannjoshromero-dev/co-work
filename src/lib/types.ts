export const ROLES = ["COORDINATOR", "INTERVIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const INTERVIEW_STATUSES = [
  "UPCOMING",
  "DONE",
  "CANCELED",
  "FAILED",
  "RESCHEDULED",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  workspaceId: string;
  workspaceName: string;
  timezone: string;
  memberId: string;
  role: Role;
};

export type ResumeFile = {
  key: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

export type Interview = {
  id: string;
  workspaceId: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string;
  resume: ResumeFile;
  jobDescriptionHtml: string;
  status: InterviewStatus;
  interviewerConfirmedAt: string | null;
  interviewerConfirmedByName: string | null;
  feedback: string | null;
  feedbackSubmittedAt: string | null;
  feedbackConfirmedAt: string | null;
  feedbackConfirmedByName: string | null;
  rescheduledFromInterviewId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  user: SessionUser;
  interviews: Interview[];
};

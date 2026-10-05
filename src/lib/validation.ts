import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { INTERVIEW_STATUSES } from "./types";
import { AppError } from "./errors";

const allowedResumeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const resumeSchema = z.object({
  key: z.string().min(1).max(500),
  url: z.string().url().max(2048),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(8 * 1024 * 1024),
  mimeType: z.enum(allowedResumeTypes),
});

export const interviewInputSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(480),
  meetingUrl: z.string().url().max(2048).refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS meeting link"),
  resume: resumeSchema,
  jobDescriptionHtml: z.string().min(1).max(50_000),
  rescheduledFromInterviewId: z.string().uuid().nullable().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const feedbackSchema = z.object({
  status: z.enum(INTERVIEW_STATUSES).refine((status) => status !== "UPCOMING", "Choose a final status"),
  feedback: z.string().trim().min(1, "Feedback is required").max(10_000),
  expectedVersion: z.number().int().nonnegative(),
});

export const versionSchema = z.object({ expectedVersion: z.number().int().nonnegative() });

export const timezoneSchema = z.object({
  timezone: z.string().min(1).max(100).refine((value) => {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone"),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1, "Password is required").max(200),
});

export function cleanRichText(value: string) {
  const cleaned = sanitizeHtml(value, {
    allowedTags: ["h2", "h3", "p", "strong", "b", "em", "i", "ul", "ol", "li", "a", "br"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  }).trim();
  if (!cleaned || !sanitizeHtml(cleaned, { allowedTags: [], allowedAttributes: {} }).trim()) {
    throw new AppError(400, "Job description cannot be empty.");
  }
  return cleaned;
}

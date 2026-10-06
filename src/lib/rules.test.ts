import { describe, expect, it } from "vitest";
import { canCancelInterview, canConfirmFeedback, canConfirmInterview, canDeleteInterview, canEditFeedback, canEditInterview, isFresh, roleAllowed, type LockState } from "./rules";

const base: LockState = { role: "COORDINATOR", version: 2, expectedVersion: 2, interviewerConfirmedAt: null, feedback: null, feedbackConfirmedAt: null, status: "UPCOMING" };

describe("authorization and permanent locks", () => {
  it("enforces authentication roles", () => {
    expect(roleAllowed("COORDINATOR", "COORDINATOR")).toBe(true);
    expect(roleAllowed("INTERVIEWER", "COORDINATOR")).toBe(false);
  });
  it("allows a Coordinator to edit and delete only before confirmation", () => {
    expect(canEditInterview(base)).toBe(true);
    expect(canDeleteInterview(base)).toBe(true);
    const confirmed = { ...base, interviewerConfirmedAt: new Date().toISOString() };
    expect(canEditInterview(confirmed)).toBe(false);
    expect(canDeleteInterview(confirmed)).toBe(false);
  });
  it("allows only an Interviewer to confirm an unconfirmed interview", () => {
    expect(canConfirmInterview({ ...base, role: "INTERVIEWER" })).toBe(true);
    expect(canConfirmInterview(base)).toBe(false);
    expect(canConfirmInterview({ ...base, role: "INTERVIEWER", interviewerConfirmedAt: "2026-01-01" })).toBe(false);
  });
  it("allows a Coordinator to cancel a confirmed upcoming interview", () => {
    const confirmed = { ...base, interviewerConfirmedAt: "2026-01-01" };
    expect(canCancelInterview(confirmed)).toBe(true);
    expect(canCancelInterview({ ...confirmed, role: "INTERVIEWER" })).toBe(false);
    expect(canCancelInterview({ ...confirmed, status: "CANCELED" })).toBe(false);
    expect(canCancelInterview({ ...confirmed, feedback: "Already completed", status: "DONE" })).toBe(false);
  });
  it("lets the Interviewer edit submitted feedback until Coordinator confirmation", () => {
    const editable = { ...base, role: "INTERVIEWER" as const, interviewerConfirmedAt: "2026-01-01", feedback: "Recommend", status: "DONE" as const };
    expect(canEditFeedback(editable)).toBe(true);
    expect(canEditFeedback({ ...editable, feedbackConfirmedAt: "2026-01-02" })).toBe(false);
    expect(canEditFeedback({ ...editable, role: "COORDINATOR" })).toBe(false);
  });
  it("allows the Coordinator—not the Interviewer—to confirm final feedback", () => {
    const ready = { ...base, feedback: "Recommend", status: "DONE" as const };
    expect(canConfirmFeedback(ready)).toBe(true);
    expect(canConfirmFeedback({ ...ready, role: "INTERVIEWER" })).toBe(false);
    expect(canConfirmFeedback({ ...ready, status: "UPCOMING" })).toBe(false);
  });
  it("permanently locks status and feedback after feedback confirmation", () => {
    const locked = { ...base, role: "INTERVIEWER" as const, interviewerConfirmedAt: "2026-01-01", feedback: "Recommend", feedbackConfirmedAt: "2026-01-02", status: "DONE" as const };
    expect(canEditFeedback(locked)).toBe(false);
    expect(canConfirmFeedback({ ...locked, role: "COORDINATOR" })).toBe(false);
  });
  it("rejects stale concurrent versions", () => {
    expect(isFresh(base)).toBe(true);
    expect(isFresh({ ...base, version: 3 })).toBe(false);
  });
});

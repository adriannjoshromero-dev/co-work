import { describe, expect, it } from "vitest";
import { getZonedDateKey, localInputToUtc, relativeStartLabel } from "./time";

describe("workspace timezone behavior", () => {
  it("uses the correct New York offset on either side of daylight saving time", () => {
    expect(localInputToUtc("2026-01-15T10:30", "America/New_York")).toBe("2026-01-15T15:30:00.000Z");
    expect(localInputToUtc("2026-07-15T10:30", "America/New_York")).toBe("2026-07-15T14:30:00.000Z");
  });
  it("groups dates in the workspace rather than browser timezone", () => {
    expect(getZonedDateKey("2026-10-03T02:00:00.000Z", "America/New_York")).toBe("2026-10-02");
  });
  it("shows active and future countdown states without negatives", () => {
    const now = new Date("2026-10-02T14:00:00.000Z");
    expect(relativeStartLabel("2026-10-02T15:24:00.000Z", 60, now)).toBe("Starts in 1 hr 24 min");
    expect(relativeStartLabel("2026-10-02T13:45:00.000Z", 60, now)).toBe("Happening now");
  });
});

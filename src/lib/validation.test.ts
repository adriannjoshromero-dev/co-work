import { describe, expect, it } from "vitest";
import { loginSchema } from "./validation";

describe("login validation", () => {
  it("accepts an existing password of any non-empty length", () => {
    expect(loginSchema.safeParse({ username: "coordinator", password: "secret" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "interviewer", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ username: "coordinator", password: "" }).success).toBe(false);
  });
});

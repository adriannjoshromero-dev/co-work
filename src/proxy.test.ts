import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("request proxy", () => {
  it("rejects malformed Server Action probes", () => {
    const request = new NextRequest("http://localhost/", {
      method: "POST",
      headers: { "next-action": "x" },
    });

    expect(proxy(request).status).toBe(400);
  });

  it("allows ordinary uploads and requests", () => {
    const request = new NextRequest("http://localhost/api/uploadthing?slug=resume", {
      method: "POST",
    });

    expect(proxy(request).status).toBe(200);
  });

  it("does not block a correctly shaped Server Action ID", () => {
    const request = new NextRequest("http://localhost/", {
      method: "POST",
      headers: { "next-action": "a".repeat(42) },
    });

    expect(proxy(request).status).toBe(200);
  });
});

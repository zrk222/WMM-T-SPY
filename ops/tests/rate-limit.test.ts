import { beforeEach, describe, expect, it } from "vitest";
import { rateLimitExact, resetRateLimits } from "@/lib/rate-limit";

const req = (method = "GET") =>
  new Request("http://x/api/thing", { method, headers: { "x-forwarded-for": "203.0.113.9" } });

describe("rate limit unit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the read limit then 429s", () => {
    expect(rateLimitExact(req(), 2).ok).toBe(true);
    expect(rateLimitExact(req(), 2).ok).toBe(true);
    const blocked = rateLimitExact(req(), 2);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts writes separately from reads", () => {
    expect(rateLimitExact(req("POST"), 1).ok).toBe(true);
    expect(rateLimitExact(req("POST"), 1).ok).toBe(false);
    expect(rateLimitExact(req("GET"), 1).ok).toBe(true);
  });

  it("isolates clients by ip", () => {
    const a = new Request("http://x/", { headers: { "x-forwarded-for": "198.51.100.1" } });
    const b = new Request("http://x/", { headers: { "x-forwarded-for": "198.51.100.2" } });
    expect(rateLimitExact(a, 1).ok).toBe(true);
    expect(rateLimitExact(a, 1).ok).toBe(false);
    expect(rateLimitExact(b, 1).ok).toBe(true);
  });
});

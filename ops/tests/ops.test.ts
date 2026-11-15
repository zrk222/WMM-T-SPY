import { describe, expect, it } from "vitest";
import { bootstrapAdmin, BASE, Client } from "./helpers";

describe("ops endpoints", () => {
  it("answers MCP preflight with allow + CORS", async () => {
    const res = await fetch(`${BASE}/api/mcp`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("serves version metadata", async () => {
    const res = await fetch(`${BASE}/api/version`);
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("cloudops-console");
  });

  it("deep health reports readiness and counts", async () => {
    const res = await fetch(`${BASE}/api/health?deep=1`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.counts.users).toBeGreaterThan(0);
  });

  it("stamps a request id on responses", async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("scopes the audit-derived activity feed to the caller", async () => {
    const admin = await bootstrapAdmin();
    const mine = new Client();
    await mine.signup(undefined, "team");
    await mine.post("/api/services", { name: `act-${Date.now()}` });

    const other = new Client();
    await other.signup(undefined, "team");
    await other.post("/api/services", { name: `act2-${Date.now()}` });

    const mineFeed = await mine.get("/api/activity?pageSize=100");
    expect(mineFeed.data.items.some((i: { kind: string }) => i.kind === "service")).toBe(true);

    const adminFeed = await admin.get("/api/activity?pageSize=100");
    expect(adminFeed.data.items.length).toBeGreaterThan(mineFeed.data.items.length);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let admin: Client;

beforeAll(async () => {
  admin = await bootstrapAdmin();
});

describe("entitlements", () => {
  it("free plan caps services at three", async () => {
    const c = new Client();
    await c.signup(undefined, "free");
    for (let i = 0; i < 3; i++) {
      expect((await c.post("/api/services", { name: `free-${i}-${Date.now()}` })).status).toBe(201);
    }
    const fourth = await c.post("/api/services", { name: "one-too-many" });
    expect(fourth.status).toBe(403);
    expect(fourth.data.error).toMatch(/limit/i);
  });

  it("free plan caps API keys at one", async () => {
    const c = new Client();
    await c.signup(undefined, "free");
    expect((await c.post("/api/keys", { name: "first" })).status).toBe(201);
    const second = await c.post("/api/keys", { name: "second" });
    expect(second.status).toBe(409);
  });

  it("free plan cannot mint ops:write keys", async () => {
    const c = new Client();
    await c.signup(undefined, "free");
    const res = await c.post("/api/keys", { name: "rw", scopes: ["ops:read", "ops:write"] });
    expect(res.status).toBe(403);
  });

  it("team plan can mint write keys and create incidents over MCP", async () => {
    const c = new Client();
    await c.signup(undefined, "team");
    const key = await c.post("/api/keys", { name: "rw", scopes: ["ops:read", "ops:write"] });
    expect(key.status).toBe(201);
    expect(key.data.key.startsWith("ck_")).toBe(true);
  });

  it("plan is re-read from the database on every request", async () => {
    const c = new Client();
    const user = await c.signup(undefined, "free");
    expect((await c.post("/api/services", { name: `x${Date.now()}` })).status).toBe(201);

    await admin.patch(`/api/admin/users?id=${user.id}`, { plan: "scale" });
    for (let i = 0; i < 3; i++) {
      expect((await c.post("/api/services", { name: `s${i}${Date.now()}` })).status).toBe(201);
    }
  });
});

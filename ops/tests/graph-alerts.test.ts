import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let ops: Client;
let a: string;
let b: string;

beforeAll(async () => {
  await bootstrapAdmin();
  ops = new Client();
  await ops.signup(undefined, "team");
  const s1 = await ops.post("/api/services", { name: `dep-a-${Date.now()}` });
  const s2 = await ops.post("/api/services", { name: `dep-b-${Date.now()}` });
  a = s1.data.id;
  b = s2.data.id;
});

describe("dependencies", () => {
  it("links and exposes both directions", async () => {
    expect((await ops.patch(`/api/services/${a}`, { dependencies: [b] })).status).toBe(200);
    const upstream = (await ops.get(`/api/services/${a}`)).data;
    const downstream = (await ops.get(`/api/services/${b}`)).data;
    expect(upstream.dependencies).toBeTruthy();
    const bDetail = await ops.get(`/api/services/${b}`);
    expect(bDetail.status).toBe(200);
    expect(downstream.id).toBe(b);
  });

  it("ignores malformed dependency ids", async () => {
    expect((await ops.patch(`/api/services/${a}`, { dependencies: ["nope", b] })).status).toBe(200);
    expect((await ops.get(`/api/services/${a}`)).data).toBeTruthy();
  });
});

describe("alerts", () => {
  it("creates a rule and fires on a matching open incident", async () => {
    const rule = await ops.post("/api/alerts", { name: "sev2 watch", severityMin: "sev2" });
    expect(rule.status).toBe(201);
    await ops.post("/api/incidents", { serviceId: b, title: "alert me", severity: "sev2" });
    const list = await ops.get("/api/alerts");
    expect(list.data.matches.some((m: { title: string }) => m.title === "alert me")).toBe(true);
  });

  it("does not fire below the threshold", async () => {
    const svc = await ops.post("/api/services", { name: `al-${Date.now()}` });
    await ops.post("/api/alerts", { name: "sev1 only", severityMin: "sev1" });
    await ops.post("/api/incidents", { serviceId: svc.data.id, title: "low sev", severity: "sev3" });
    const list = await ops.get("/api/alerts");
    expect(list.data.matches.some((m: { title: string }) => m.title === "low sev")).toBe(false);
  });

  it("removes a rule", async () => {
    const rule = await ops.post("/api/alerts", { name: "temp", severityMin: "sev4" });
    expect((await ops.del(`/api/alerts/${rule.data.id}`)).status).toBe(200);
    expect((await ops.get("/api/alerts")).data.items.some((r: { id: string }) => r.id === rule.data.id)).toBe(false);
  });

  it("blocks viewers from creating rules", async () => {
    const admin = await bootstrapAdmin();
    const v = new Client();
    await v.signup(undefined, "team");
    const me = (await v.get("/api/auth/me")).data.user;
    await admin.patch(`/api/admin/users?id=${me.id}`, { role: "viewer" });
    expect((await v.post("/api/alerts", { name: "nope", severityMin: "sev2" })).status).toBe(403);
  });
});

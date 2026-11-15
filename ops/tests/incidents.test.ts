import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let ops: Client;
let viewer: Client;
let serviceId: string;
let viewerServiceId: string;

beforeAll(async () => {
  await bootstrapAdmin();
  ops = new Client();
  await ops.signup(undefined, "team");
  viewer = new Client();
  await viewer.signup(undefined, "team");
  const own = await viewer.post("/api/services", { name: `v-${Date.now()}` });
  const admin = await bootstrapAdmin();
  await admin.patch(`/api/admin/users?id=${(await viewer.get("/api/auth/me")).data.user.id}`, { role: "viewer" });
  await viewer.req("/api/auth/me");
  viewerServiceId = own.data.id;

  const svc = await ops.post("/api/services", { name: `svc-${Date.now()}`, tier: 1 });
  expect(svc.status).toBe(201);
  serviceId = svc.data.id;
});

describe("incidents", () => {
  it("creates an incident and appends an opened event", async () => {
    const res = await ops.post("/api/incidents", { serviceId, title: "Elevated 5xx", severity: "sev1", impact: "major" });
    expect(res.status).toBe(201);
    const detail = await ops.get(`/api/incidents/${res.data.id}`);
    expect(detail.status).toBe(200);
    expect(detail.data.state).toBe("open");
    expect(detail.data.events[0].kind).toBe("opened");
    expect(detail.data.allowed).toEqual(["acknowledged"]);
  });

  it("rejects an illegal transition with 409", async () => {
    const inc = await ops.post("/api/incidents", { serviceId, title: "Skip states" });
    const res = await ops.patch(`/api/incidents/${inc.data.id}`, { state: "resolved" });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/Illegal transition/);
  });

  it("walks open â†’ acknowledged â†’ monitoring â†’ resolved", async () => {
    const inc = await ops.post("/api/incidents", { serviceId, title: "Lifecycle" });
    const id = inc.data.id;
    expect((await ops.patch(`/api/incidents/${id}`, { state: "acknowledged" })).status).toBe(200);
    expect((await ops.patch(`/api/incidents/${id}`, { state: "monitoring" })).status).toBe(200);
    const done = await ops.patch(`/api/incidents/${id}`, { state: "resolved", resolutionNote: "fixed" });
    expect(done.status).toBe(200);

    const detail = await ops.get(`/api/incidents/${id}`);
    expect(detail.data.state).toBe("resolved");
    expect(detail.data.resolvedAt).toBeTruthy();
    expect(detail.data.events.map((e: { kind: string }) => e.kind)).toContain("resolved");
  });

  it("adds timeline notes", async () => {
    const inc = await ops.post("/api/incidents", { serviceId, title: "Notes" });
    const res = await ops.post(`/api/incidents/${inc.data.id}/notes`, { note: "checked psp status" });
    expect(res.status).toBe(201);
    const detail = await ops.get(`/api/incidents/${inc.data.id}`);
    expect(detail.data.events.some((e: { kind: string; note: string }) => e.kind === "note" && e.note.includes("psp"))).toBe(true);
  });

  it("blocks viewers from mutating", async () => {
    const res = await viewer.post("/api/incidents", { serviceId: viewerServiceId, title: "viewer attempt" });
    expect(res.status).toBe(403);
  });

  it("refuses to delete a service with open incidents", async () => {
    const admin = await bootstrapAdmin();
    const svc = await admin.post("/api/services", { name: `busy-${Date.now()}` });
    await admin.post("/api/incidents", { serviceId: svc.data.id, title: "still open" });
    const del = await admin.del(`/api/services/${svc.data.id}`);
    expect(del.status).toBe(409);
  });

  it("returns 404 for unknown ids", async () => {
    expect((await ops.get("/api/incidents/000000000000000000000000")).status).toBe(404);
  });
});

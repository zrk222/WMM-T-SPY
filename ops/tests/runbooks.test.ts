import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let ops: Client;
let viewer: Client;
let runbookId: string;

beforeAll(async () => {
  const admin = await bootstrapAdmin();
  ops = new Client();
  await ops.signup(undefined, "team");
  const rb = await ops.post("/api/runbooks", {
    name: `rb-${Date.now()}`,
    steps: [{ title: "check", command: "echo ok" }],
  });
  expect(rb.status).toBe(201);
  runbookId = rb.data.id;

  viewer = new Client();
  await viewer.signup(undefined, "team");
  const me = (await viewer.get("/api/auth/me")).data.user;
  await admin.patch(`/api/admin/users?id=${me.id}`, { role: "viewer" });
  await viewer.req("/api/auth/me");
});

describe("runbook executions", () => {
  it("logs a run and lists it", async () => {
    const res = await ops.post(`/api/runbooks/${runbookId}/runs`, { status: "ok", note: "done fast" });
    expect(res.status).toBe(201);
    const list = await ops.get(`/api/runbooks/${runbookId}/runs`);
    expect(list.data.items[0].status).toBe("ok");
    expect(list.data.items[0].note).toBe("done fast");
  });

  it("validates the status enum", async () => {
    const res = await ops.post(`/api/runbooks/${runbookId}/runs`, { status: "meh" });
    expect(res.status).toBe(400);
  });

  it("lets viewers read but not log", async () => {
    expect((await viewer.get(`/api/runbooks/${runbookId}/runs`)).status).toBe(200);
    expect((await viewer.post(`/api/runbooks/${runbookId}/runs`, { status: "ok" })).status).toBe(403);
  });

  it("404s an unknown runbook", async () => {
    expect((await ops.post("/api/runbooks/000000000000000000000000/runs", { status: "ok" })).status).toBe(404);
  });
});

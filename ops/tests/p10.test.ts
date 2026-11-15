import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let ops: Client;
let serviceId: string;
let hookUrl: string;
let received: { body: string }[] = [];
let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  await bootstrapAdmin();
  ops = new Client();
  await ops.signup(undefined, "team");
  const svc = await ops.post("/api/services", { name: `hook-${Date.now()}` });
  serviceId = svc.data.id;

  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ body });
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("webhook delivery", () => {
  it("posts the incident to a matching hook and records the delivery", async () => {
    const rule = await ops.post("/api/alerts", { name: "hook", severityMin: "sev2", webhookUrl: hookUrl });
    expect(rule.status).toBe(201);

    await ops.post("/api/incidents", { serviceId, title: "hook me", severity: "sev1" });
    await new Promise((r) => setTimeout(r, 400));

    expect(received.length).toBeGreaterThan(0);
    const payload = JSON.parse(received[0].body);
    expect(payload.incident.title).toBe("hook me");

    const list = await ops.get("/api/alerts");
    expect(list.data.deliveries[0].status).toBe(200);
  });

  it("survives an unreachable hook", async () => {
    await ops.post("/api/alerts", { name: "dead", severityMin: "sev4", webhookUrl: "http://127.0.0.1:59999/nope" });
    const inc = await ops.post("/api/incidents", { serviceId, title: "dead hook", severity: "sev4" });
    expect(inc.status).toBe(201);
    await new Promise((r) => setTimeout(r, 600));
    const list = await ops.get("/api/alerts");
    expect(list.data.deliveries.some((d: { status: number | null; error: string | null }) => d.status === null && d.error)).toBe(true);
  });
});

describe("bulk actions", () => {
  it("acknowledges several incidents and reports per-id results", async () => {
    const a = await ops.post("/api/incidents", { serviceId, title: "bulk a" });
    const b = await ops.post("/api/incidents", { serviceId, title: "bulk b" });
    const res = await ops.post("/api/incidents/bulk", { ids: [a.data.id, b.data.id, "bad"], action: "acknowledge" });
    if (res.status !== 200) console.log("BULK", res.status, JSON.stringify(res.data), JSON.stringify([a.data, b.data]));
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(2);
    expect(res.data.failed).toBe(1);
    expect((await ops.get(`/api/incidents/${a.data.id}`)).data.state).toBe("acknowledged");
  });

  it("409s when nothing can transition", async () => {
    const inc = await ops.post("/api/incidents", { serviceId, title: "skip" });
    const res = await ops.post("/api/incidents/bulk", { ids: [inc.data.id], action: "resolve" });
    expect(res.status).toBe(409);
  });
});

describe("postmortem", () => {
  it("requires resolution, then saves and exports markdown", async () => {
    const inc = await ops.post("/api/incidents", { serviceId, title: "pm case" });
    const body = { summary: "checkout failed for 10 minutes", rootCause: "psp outage", actions: ["add fallback psp"] };
    expect((await ops.req(`/api/incidents/${inc.data.id}/postmortem`, { method: "PUT", body })).status).toBe(409);

    await ops.patch(`/api/incidents/${inc.data.id}`, { state: "acknowledged" });
    await ops.patch(`/api/incidents/${inc.data.id}`, { state: "resolved" });
    expect((await ops.req(`/api/incidents/${inc.data.id}/postmortem`, { method: "PUT", body })).status).toBe(200);

    const md = await fetch(`${process.env.BASE_URL}/api/incidents/${inc.data.id}/postmortem`, {
      headers: { cookie: Object.entries(ops.cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    expect(md.headers.get("content-type")).toContain("markdown");
    expect(await md.text()).toContain("psp outage");
  });
});

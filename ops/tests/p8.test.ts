import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, BASE, Client, keyClient } from "./helpers";

let admin: Client;
let serviceId: string;
let runbookId: string;

beforeAll(async () => {
  admin = await bootstrapAdmin();
  const svc = await admin.post("/api/services", { name: `p8-${Date.now()}` });
  serviceId = svc.data.id;
  const rb = await admin.post("/api/runbooks", { name: `p8rb-${Date.now()}`, steps: [{ title: "step" }] });
  runbookId = rb.data.id;
});

describe("search and metrics", () => {
  it("searches services and incidents", async () => {
    const res = await admin.get(`/api/search?q=p8-`);
    expect(res.status).toBe(200);
    expect(res.data.services.some((s: { id: string }) => s.id === serviceId)).toBe(true);
  });

  it("returns metrics JSON and Prometheus text", async () => {
    const j = await admin.get("/api/metrics");
    expect(j.status).toBe(200);
    expect(typeof j.data.services).toBe("number");
    expect(j.data).toHaveProperty("mttrMinutes");

    const raw = await fetch(`${BASE}/api/metrics?format=prom`, { headers: { cookie: Object.entries(admin.cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });
    expect(raw.headers.get("content-type")).toContain("text/plain");
    expect(await raw.text()).toContain("cloudops_services");
  });

  it("exports incidents as CSV with proper content type", async () => {
    const raw = await fetch(`${BASE}/api/incidents?format=csv`, { headers: { cookie: Object.entries(admin.cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });
    expect(raw.headers.get("content-type")).toContain("text/csv");
    expect(raw.headers.get("content-disposition")).toContain("incidents.csv");
    expect((await raw.text()).split("\n")[0]).toContain("severity");
  });

  it("serves public status without auth", async () => {
    const res = await fetch(`${BASE}/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services.some((s: { name: string }) => s.name.startsWith("p8-"))).toBe(true);
    expect(body.summary.services).toBeGreaterThan(0);
  });
});

describe("edit and delete flows", () => {
  it("patches a service and reflects it", async () => {
    expect((await admin.patch(`/api/services/${serviceId}`, { owner: "sre" })).status).toBe(200);
    expect((await admin.get(`/api/services/${serviceId}`)).data.owner).toBe("sre");
  });

  it("deletes an SLO", async () => {
    const created = await admin.post("/api/slos", { serviceId, target: 99.5, windowDays: 7 });
    expect(created.status).toBe(201);
    expect((await admin.del(`/api/slos/${created.data.id}`)).status).toBe(200);
    expect((await admin.get("/api/slos")).data.items.some((s: { serviceId: string }) => s.serviceId === serviceId)).toBe(false);
  });

  it("deletes an empty service but refuses one with open incidents", async () => {
    const svc = await admin.post("/api/services", { name: `del-${Date.now()}` });
    expect((await admin.del(`/api/services/${svc.data.id}`)).status).toBe(200);

    const busy = await admin.post("/api/services", { name: `busy2-${Date.now()}` });
    await admin.post("/api/incidents", { serviceId: busy.data.id, title: "open" });
    expect((await admin.del(`/api/services/${busy.data.id}`)).status).toBe(409);
  });
});

describe("mcp additions", () => {
  it("exposes error budget and runbook runs", async () => {
    await admin.post("/api/slos", { serviceId, target: 99.9, windowDays: 30 });
    await admin.post(`/api/runbooks/${runbookId}/runs`, { status: "ok" });
    const key = await admin.post("/api/keys", { name: "p8", scopes: ["ops:read"] });
    const k = keyClient(key.data.key);

    const budget = await k.call({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_error_budget", arguments: { serviceId } } });
    expect(budget.data.result.structuredContent.result.remainingPct).toBeGreaterThanOrEqual(0);

    const runs = await k.call({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_runbook_runs", arguments: { runbookId } } });
    expect(runs.data.result.structuredContent.result[0].status).toBe("ok");
  });
});

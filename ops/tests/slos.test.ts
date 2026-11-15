import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let ops: Client;
let serviceId: string;

beforeAll(async () => {
  await bootstrapAdmin();
  ops = new Client();
  await ops.signup(undefined, "team");
  const svc = await ops.post("/api/services", { name: `slo-${Date.now()}` });
  serviceId = svc.data.id;
});

describe("slo error budget", () => {
  it("starts with a full budget", async () => {
    await ops.post("/api/slos", { serviceId, target: 99.9, windowDays: 30 });
    const res = await ops.get("/api/slos");
    expect(res.status).toBe(200);
    const row = res.data.items[0];
    expect(row.budget.remainingPct).toBe(100);
    expect(row.budget.state).toBe("ok");
  });

  it("consumes budget while an incident is open and flags exhaustion", async () => {
    await ops.post("/api/slos", { serviceId, target: 99.999, windowDays: 7 });
    const inc = await ops.post("/api/incidents", { serviceId, title: "burn" });
    await new Promise((r) => setTimeout(r, 7500));

    const res = await ops.get("/api/slos");
    const row = res.data.items.find((r: { serviceId: string }) => r.serviceId === serviceId);
    expect(row.budget.consumedMinutes).toBeGreaterThan(0);
    expect(row.budget.state).toBe("exhausted");

    await ops.patch(`/api/incidents/${inc.data.id}`, { state: "acknowledged" });
    await ops.patch(`/api/incidents/${inc.data.id}`, { state: "resolved" });
    const after = await ops.get("/api/slos");
    expect(after.data.items.find((r: { serviceId: string }) => r.serviceId === serviceId).budget.consumedMinutes).toBeGreaterThan(0);
  });

  it("rejects out-of-range targets", async () => {
    const res = await ops.post("/api/slos", { serviceId, target: 50, windowDays: 30 });
    expect(res.status).toBe(400);
  });
});

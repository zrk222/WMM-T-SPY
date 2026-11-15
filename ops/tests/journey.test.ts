import { describe, expect, it } from "vitest";
import { bootstrapAdmin, Client, keyClient } from "./helpers";

/**
 * Definition-of-done journey: signup → service → incident → resolve → key →
 * MCP read/write → admin visibility. One tenant, one pass, no mocks.
 */
describe("journey", () => {
  it("walks the whole operational loop", async () => {
    const admin = await bootstrapAdmin();

    const svc = await admin.post("/api/services", { name: "journey-svc", tier: 1 });
    expect(svc.status).toBe(201);

    const inc = await admin.post("/api/incidents", { serviceId: svc.data.id, title: "journey incident", severity: "sev2" });
    expect(inc.status).toBe(201);

    expect((await admin.patch(`/api/incidents/${inc.data.id}`, { state: "acknowledged" })).status).toBe(200);
    expect((await admin.patch(`/api/incidents/${inc.data.id}`, { state: "resolved", resolutionNote: "done" })).status).toBe(200);

    const key = await admin.post("/api/keys", { name: "journey", scopes: ["ops:read", "ops:write"] });
    expect(key.status).toBe(201);

    const k = keyClient(key.data.key);
    const list = await k.call({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_incidents", arguments: { open: false } } });
    expect(list.data.result.structuredContent.result.some((i: { title: string }) => i.title === "journey incident")).toBe(true);

    const created = await k.call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "create_incident", arguments: { serviceId: svc.data.id, title: "opened by journey agent" } },
    });
    expect(created.data.result.structuredContent.result.id).toBeTruthy();

    const adminPage = await admin.get("/api/admin/users");
    expect(adminPage.status).toBe(200);
    expect(adminPage.data.items.length).toBeGreaterThan(0);
  });
});

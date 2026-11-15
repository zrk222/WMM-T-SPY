import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client, keyClient } from "./helpers";

let admin: Client;
let readKey: string;
let writeKey: string;
let serviceId: string;

beforeAll(async () => {
  admin = await bootstrapAdmin();
  const svc = await admin.post("/api/services", { name: `mcp-${Date.now()}` });
  serviceId = svc.data.id;

  const read = await admin.post("/api/keys", { name: "read", scopes: ["ops:read"] });
  expect(read.status).toBe(201);
  readKey = read.data.key;

  const write = await admin.post("/api/keys", { name: "write", scopes: ["ops:read", "ops:write"] });
  writeKey = write.data.key;
});

describe("mcp", () => {
  it("401 with discovery header when no bearer is sent", async () => {
    const res = await fetch(`${process.env.BASE_URL}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata");
    expect((await res.json()).error).toMatch(/Bearer/);
  });

  it("rejects a session cookie (key-only surface)", async () => {
    const res = await fetch(`${process.env.BASE_URL}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: Object.entries(admin.cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    expect(res.status).toBe(401);
  });

  it("answers initialize and lists tools", async () => {
    const k = keyClient(readKey);
    const init = await k.call({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(init.status).toBe(200);
    expect(init.data.result.serverInfo.name).toBe("cloudops-console");

    const list = await k.call({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(list.data.result.tools.map((t: { name: string }) => t.name)).toContain("list_services");
  });

  it("read key can list but not write", async () => {
    const k = keyClient(readKey);
    const read = await k.call({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_services", arguments: {} } });
    expect(read.data.result).toBeTruthy();

    const write = await k.call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "create_incident", arguments: { serviceId, title: "from read key" } },
    });
    expect(write.data.error.message).toMatch(/ops:write/);
  });

  it("write key opens an incident that shows up over HTTP", async () => {
    const k = keyClient(writeKey);
    const res = await k.call({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "create_incident", arguments: { serviceId, title: "opened by agent", severity: "sev2" } },
    });
    expect(res.data.result.structuredContent.result.id).toBeTruthy();

    const listed = await admin.get(`/api/incidents?serviceId=${serviceId}`);
    expect(listed.data.items.some((i: { title: string }) => i.title === "opened by agent")).toBe(true);
  });

  it("revocation is immediate", async () => {
    const created = await admin.post("/api/keys", { name: "temp", scopes: ["ops:read"] });
    const k = keyClient(created.data.key);
    expect((await k.call({ jsonrpc: "2.0", id: 6, method: "tools/list" })).status).toBe(200);
    await admin.del(`/api/keys/${created.data.id}`);
    expect((await k.call({ jsonrpc: "2.0", id: 7, method: "tools/list" })).status).toBe(401);
  });
});

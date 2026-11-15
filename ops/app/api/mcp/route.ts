import { ObjectId } from "mongodb";
import { authenticateKey, type KeyAuth } from "@/lib/api-keys";
import { incidentEvents, incidents, runbooks, services, slos } from "@/lib/collections";
import { limitsFor, within } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";

type Rpc = { jsonrpc: "2.0"; id: string | number | null; method: string; params?: unknown };

const TOOLS = [
  {
    name: "list_services",
    description: "List services with optional text query. Read scope.",
    inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "number" } } },
    scope: "ops:read",
  },
  {
    name: "list_incidents",
    description: "List incidents, optionally only open ones. Read scope.",
    inputSchema: { type: "object", properties: { open: { type: "boolean" }, severity: { type: "string" }, limit: { type: "number" } } },
    scope: "ops:read",
  },
  {
    name: "get_incident",
    description: "Fetch one incident with its timeline. Read scope.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    scope: "ops:read",
  },
  {
    name: "create_incident",
    description: "Open an incident on a service. Write scope.",
    inputSchema: {
      type: "object",
      properties: { serviceId: { type: "string" }, title: { type: "string" }, severity: { type: "string" } },
      required: ["serviceId", "title"],
    },
    scope: "ops:write",
  },
  {
    name: "list_runbooks",
    description: "List runbooks. Read scope.",
    inputSchema: { type: "object", properties: {} },
    scope: "ops:read",
  },
  {
    name: "get_slo",
    description: "SLO for a service. Read scope.",
    inputSchema: { type: "object", properties: { serviceId: { type: "string" } }, required: ["serviceId"] },
    scope: "ops:read",
  },
] as const;

function rpcOk(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcErr(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function needScope(key: KeyAuth, scope: string) {
  if (!key.scopes.includes(scope as never)) throw new Error(`Missing scope ${scope}`);
}

async function callTool(name: string, args: Record<string, unknown>, key: KeyAuth) {
  const limit = Math.min(Number(args.limit ?? 20) || 20, 50);
  switch (name) {
    case "list_services": {
      needScope(key, "ops:read");
      const filter: Record<string, unknown> = { ownerId: key.user._id };
      if (typeof args.q === "string" && args.q.trim()) filter.$text = { $search: args.q.trim() };
      const rows = await (await services()).find(filter as never).limit(limit).toArray();
      return rows.map((s) => ({ id: s._id.toHexString(), name: s.name, tier: s.tier, owner: s.owner }));
    }
    case "list_incidents": {
      needScope(key, "ops:read");
      const filter: Record<string, unknown> = { ownerId: key.user._id };
      if (args.open === true) filter.state = { $ne: "resolved" };
      if (typeof args.severity === "string") filter.severity = args.severity;
      const rows = await (await incidents()).find(filter as never).sort({ openedAt: -1 }).limit(limit).toArray();
      return rows.map((i) => ({ id: i._id.toHexString(), serviceId: i.serviceId.toHexString(), title: i.title, severity: i.severity, state: i.state }));
    }
    case "get_incident": {
      needScope(key, "ops:read");
      const id = String(args.id ?? "");
      if (!ObjectId.isValid(id)) throw new Error("Unknown incident");
      const inc = await (await incidents()).findOne({ _id: new ObjectId(id), ownerId: key.user._id } as never);
      if (!inc) throw new Error("Unknown incident");
      const events = await (await incidentEvents()).find({ incidentId: inc._id }).sort({ at: 1 }).toArray();
      return {
        id,
        title: inc.title,
        severity: inc.severity,
        state: inc.state,
        openedAt: inc.openedAt,
        events: events.map((e) => ({ kind: e.kind, actor: e.actor, note: e.note, at: e.at })),
      };
    }
    case "create_incident": {
      needScope(key, "ops:write");
      if (!limitsFor(key.user.plan).mcpWrite) throw new Error("Plan has no MCP write access");
      const open = await (await incidents()).countDocuments({ ownerId: key.user._id, state: { $ne: "resolved" } });
      if (!within(limitsFor(key.user.plan).openIncidents, open)) throw new Error("Open-incident limit reached");
      const serviceId = String(args.serviceId ?? "");
      if (!ObjectId.isValid(serviceId)) throw new Error("Unknown serviceId");
      const svc = await (await services()).findOne({ _id: new ObjectId(serviceId), ownerId: key.user._id } as never);
      if (!svc) throw new Error("Unknown serviceId");
      const now = new Date();
      const doc = {
        _id: new ObjectId(),
        ownerId: key.user._id,
        serviceId: svc._id,
        title: String(args.title ?? "MCP incident").slice(0, 200),
        severity: (["sev1", "sev2", "sev3", "sev4"].includes(String(args.severity)) ? String(args.severity) : "sev3") as "sev1",
        state: "open" as const,
        impact: "minor" as const,
        commander: null,
        openedBy: `${key.user.email} (mcp)`,
        openedAt: now,
        ackAt: null,
        resolvedAt: null,
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      };
      await (await incidents()).insertOne(doc);
      await (await incidentEvents()).insertOne({ _id: new ObjectId(), incidentId: doc._id, kind: "opened", actor: `${key.user.email} (mcp)`, note: null, at: now });
      await recordAudit({ actor: key.user._id.toHexString(), action: "mcp.incident.open", entity: "incident", entityId: doc._id.toHexString() });
      return { id: doc._id.toHexString() };
    }
    case "list_runbooks": {
      needScope(key, "ops:read");
      const rows = await (await runbooks()).find({ ownerId: key.user._id } as never).limit(limit).toArray();
      return rows.map((r) => ({ id: r._id.toHexString(), name: r.name, steps: r.steps.length }));
    }
    case "get_slo": {
      needScope(key, "ops:read");
      const serviceId = String(args.serviceId ?? "");
      if (!ObjectId.isValid(serviceId)) throw new Error("Unknown serviceId");
      const slo = await (await slos()).findOne({ serviceId: new ObjectId(serviceId), ownerId: key.user._id } as never);
      if (!slo) throw new Error("No SLO for service");
      return { target: slo.target, windowDays: slo.windowDays, indicator: slo.indicator };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(req, { read: 120, write: 60 });
  if (!rl.ok) return Response.json(rpcErr(null, -32000, "Rate limit exceeded"), { status: 429 });

  const key = await authenticateKey(req);
  if (!key) {
    const res = Response.json({ error: "Missing Bearer token" }, { status: 401 });
    res.headers.set("www-authenticate", 'Bearer resource_metadata="https://app.local/.well-known/oauth-protected-resource", scope="ops:read"');
    return res;
  }

  let body: Rpc;
  try {
    body = (await req.json()) as Rpc;
  } catch {
    return Response.json(rpcErr(null, -32700, "Parse error"), { status: 400 });
  }

  if (body.method === "initialize") {
    return Response.json(
      rpcOk(body.id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "cloudops-console", version: "0.1.0" },
      }),
    );
  }

  if (body.method === "tools/list") return Response.json(rpcOk(body.id, { tools: TOOLS }));

  if (body.method === "tools/call") {
    const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    try {
      const result = await callTool(String(params.name), params.arguments ?? {}, key);
      return Response.json(rpcOk(body.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: { result } }));
    } catch (e) {
      return Response.json(rpcErr(body.id, -32602, e instanceof Error ? e.message : "Tool failed"));
    }
  }

  return Response.json(rpcErr(body.id, -32601, `Unknown method ${body.method}`));
}

export function GET() {
  return Response.json({ name: "cloudops-console", transport: "http", protocol: PROTOCOL }, { status: 200, headers: { allow: "POST, GET, OPTIONS" } });
}

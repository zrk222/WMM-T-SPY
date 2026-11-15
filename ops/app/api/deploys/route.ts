import { z } from "zod";
import { ObjectId } from "mongodb";
import { deploys, services } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { fail, json, parseBody } from "@/lib/http";
import { limitsFor } from "@/lib/plans";

const schema = z.object({
  serviceId: z.string().min(1),
  version: z.string().trim().min(1).max(80),
  commit: z.string().trim().max(64).default(""),
  environment: z.enum(["staging", "production"]).default("staging"),
  status: z.enum(["started", "succeeded", "failed", "rolled_back"]).default("started"),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const days = limitsFor(g.ctx.user.plan).deployHistoryDays;
  const since = days === -1 ? new Date(0) : new Date(Date.now() - days * 86_400_000);
  const filter: Record<string, unknown> = scope(g.ctx.user, { at: { $gte: since } });
  if (serviceId && ObjectId.isValid(serviceId)) filter.serviceId = new ObjectId(serviceId);

  const rows = await (await deploys()).find(filter as never).sort({ at: -1 }).limit(100).toArray();
  return json({
    windowDays: days,
    items: rows.map((d) => ({
      id: d._id.toHexString(),
      serviceId: d.serviceId.toHexString(),
      version: d.version,
      commit: d.commit,
      environment: d.environment,
      status: d.status,
      deployedBy: d.deployedBy,
      at: d.at,
    })),
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  if (!ObjectId.isValid(parsed.data.serviceId)) return fail("Unknown serviceId", 400);
  const svc = await (await services()).findOne({ _id: new ObjectId(parsed.data.serviceId), ...scope(g.ctx.user) } as never);
  if (!svc) return fail("Unknown serviceId", 400);

  const doc = { _id: new ObjectId(), ownerId: g.ctx.user._id, serviceId: svc._id, version: parsed.data.version, commit: parsed.data.commit ?? "", environment: parsed.data.environment ?? "staging", status: parsed.data.status ?? "started", deployedBy: g.ctx.user.email, at: new Date() };
  await (await deploys()).insertOne(doc);
  return json({ id: doc._id.toHexString() }, 201);
}

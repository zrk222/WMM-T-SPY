import { z } from "zod";
import { ObjectId } from "mongodb";
import { deploys, incidents, services, slos } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { fail, json, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  owner: z.string().trim().max(120).optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dependencies: z.array(z.string()).max(20).optional(),
});

async function detail(id: string, user: import("@/lib/collections").UserDoc) {
  const oid = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!oid) return null;
  const svc = await (await services()).findOne({ _id: oid, ...scope(user) } as never);
  if (!svc) return null;
  const [openIncidents, recentDeploys, slo] = await Promise.all([
    (await incidents()).countDocuments({ serviceId: oid, state: { $ne: "resolved" } }),
    (await deploys()).find({ serviceId: oid }).sort({ at: -1 }).limit(10).toArray(),
    (await slos()).findOne({ serviceId: oid }),
  ]);
  return {
    id: svc._id.toHexString(),
    name: svc.name,
    description: svc.description,
    owner: svc.owner,
    tier: svc.tier,
    tags: svc.tags,
    dependencies: (svc.dependencies ?? []).map((d) => d.toHexString()),
    createdAt: svc.createdAt,
    openIncidents,
    slo: slo ? { target: slo.target, windowDays: slo.windowDays, indicator: slo.indicator } : null,
    recentDeploys: recentDeploys.map((d) => ({ id: d._id.toHexString(), version: d.version, status: d.status, at: d.at })),
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  const data = await detail(id, g.ctx.user);
  return data ? json(data) : fail("Service not found", 404);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Service not found", 404);
  const oid = new ObjectId(id);
  const before = await (await services()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
  if (!before) return fail("Service not found", 404);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;
  const set: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.dependencies) set.dependencies = parsed.data.dependencies.filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x));
  await (await services()).updateOne({ _id: oid }, { $set: set });
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "service.update", entity: "service", entityId: id, before, after: parsed.data });
  return json({ success: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Service not found", 404);
  const oid = new ObjectId(id);
  const before = await (await services()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
  if (!before) return fail("Service not found", 404);
  const open = await (await incidents()).countDocuments({ serviceId: oid, state: { $ne: "resolved" } });
  if (open > 0) return fail("Service has open incidents", 409);

  await (await services()).deleteOne({ _id: oid });
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "service.delete", entity: "service", entityId: id, before });
  return json({ success: true });
}

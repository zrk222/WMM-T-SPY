import { z } from "zod";
import { ObjectId } from "mongodb";
import { runbooks, services } from "@/lib/collections";
import { gate, quota } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { json, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  serviceId: z.string().nullable().optional(),
  steps: z
    .array(z.object({ title: z.string().trim().min(1).max(200), command: z.string().trim().max(500).nullable().default(null) }))
    .min(1)
    .max(40),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const rows = await (await runbooks()).find(scope(g.ctx.user) as never).sort({ name: 1 }).limit(200).toArray();
  return json({
    items: rows.map((r) => ({ id: r._id.toHexString(), name: r.name, serviceId: r.serviceId?.toHexString() ?? null, stepCount: r.steps.length })),
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const count = await (await runbooks()).countDocuments(scope(g.ctx.user));
  const over = await quota(g.ctx.user, "runbooks", count);
  if (over) return over;

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  let serviceId: ObjectId | null = null;
  if (parsed.data.serviceId) {
    if (!ObjectId.isValid(parsed.data.serviceId)) return json({ error: "Unknown serviceId" }, 400);
    const svc = await (await services()).findOne({ _id: new ObjectId(parsed.data.serviceId), ...scope(g.ctx.user) } as never);
    if (!svc) return json({ error: "Unknown serviceId" }, 400);
    serviceId = svc._id;
  }
  const now = new Date();
  const doc = { _id: new ObjectId(), ownerId: g.ctx.user._id, name: parsed.data.name, serviceId, steps: parsed.data.steps.map((s) => ({ title: s.title, command: s.command ?? null })), createdAt: now, updatedAt: now };
  await (await runbooks()).insertOne(doc);
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "runbook.create", entity: "runbook", entityId: doc._id.toHexString(), after: doc });
  return json({ id: doc._id.toHexString() }, 201);
}

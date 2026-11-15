import { z } from "zod";
import { ObjectId } from "mongodb";
import { alertRules, incidents, services } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";
import { scope } from "@/lib/scope";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  serviceId: z.string().nullable().optional(),
  severityMin: z.enum(["sev1", "sev2", "sev3", "sev4"]).default("sev2"),
});

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { sev1: 1, sev2: 2, sev3: 3, sev4: 4 };

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const owned = scope(g.ctx.user);
  const [rules, open] = await Promise.all([
    (await alertRules()).find(owned as never).sort({ createdAt: -1 }).toArray(),
    (await incidents()).find({ ...owned, state: { $ne: "resolved" } } as never).toArray(),
  ]);
  const svc = new Map((await (await services()).find(owned as never).toArray()).map((s) => [s._id.toHexString(), s.name]));

  const matches = rules
    .filter((r) => r.enabled)
    .flatMap((r) =>
      open
        .filter((i) => RANK[i.severity] <= RANK[r.severityMin] && (!r.serviceId || r.serviceId.equals(i.serviceId)))
        .map((i) => ({ rule: r.name, incidentId: i._id.toHexString(), title: i.title, severity: i.severity, service: svc.get(i.serviceId.toHexString()) ?? "—" })),
    );

  return json({
    items: rules.map((r) => ({ id: r._id.toHexString(), name: r.name, serviceId: r.serviceId?.toHexString() ?? null, severityMin: r.severityMin, enabled: r.enabled })),
    matches,
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  let serviceId: ObjectId | null = null;
  if (parsed.data.serviceId) {
    if (!ObjectId.isValid(parsed.data.serviceId)) return fail("Unknown serviceId", 400);
    serviceId = new ObjectId(parsed.data.serviceId);
  }
  const doc = { _id: new ObjectId(), ownerId: g.ctx.user._id, name: parsed.data.name, serviceId, severityMin: parsed.data.severityMin ?? "sev2", enabled: true, createdAt: new Date() };
  await (await alertRules()).insertOne(doc);
  return json({ id: doc._id.toHexString() }, 201);
}

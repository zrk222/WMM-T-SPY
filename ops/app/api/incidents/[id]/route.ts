import { z } from "zod";
import { ObjectId } from "mongodb";
import { incidentEvents, incidents, services, type IncidentEventDoc } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { fail, json, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const NEXT: Record<string, string[]> = {
  open: ["acknowledged"],
  acknowledged: ["monitoring", "resolved"],
  monitoring: ["resolved"],
  resolved: ["open"],
};

const patchSchema = z.object({
  state: z.enum(["open", "acknowledged", "monitoring", "resolved"]).optional(),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4"]).optional(),
  impact: z.enum(["critical", "major", "minor", "none"]).optional(),
  commander: z.string().trim().max(120).nullable().optional(),
  resolutionNote: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Incident not found", 404);
  const oid = new ObjectId(id);
  const inc = await (await incidents()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
  if (!inc) return fail("Incident not found", 404);
  const svc = await (await services()).findOne({ _id: inc.serviceId });
  const events = await (await incidentEvents()).find({ incidentId: oid }).sort({ at: 1 }).toArray();
  return json({
    id,
    service: svc ? { id: svc._id.toHexString(), name: svc.name } : null,
    title: inc.title,
    severity: inc.severity,
    state: inc.state,
    impact: inc.impact,
    commander: inc.commander,
    openedBy: inc.openedBy,
    openedAt: inc.openedAt,
    ackAt: inc.ackAt,
    resolvedAt: inc.resolvedAt,
    resolutionNote: inc.resolutionNote,
    events: events.map((e) => ({ kind: e.kind, actor: e.actor, note: e.note, at: e.at })),
    allowed: NEXT[inc.state] ?? [],
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Incident not found", 404);
  const oid = new ObjectId(id);
  const before = await (await incidents()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
  if (!before) return fail("Incident not found", 404);

  const parsed = await parseBody(req, patchSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  const actor = g.ctx.user.email;

  if (patch.state && patch.state !== before.state) {
    if (!(NEXT[before.state] ?? []).includes(patch.state)) {
      return fail(`Illegal transition ${before.state} â†’ ${patch.state}`, 409);
    }
    set.state = patch.state;
    if (patch.state === "acknowledged" && !before.ackAt) set.ackAt = new Date();
    if (patch.state === "resolved") set.resolvedAt = new Date();
    if (patch.state === "open") {
      set.resolvedAt = null;
      set.ackAt = null;
      set.resolutionNote = null;
    }
    await (await incidentEvents()).insertOne({
      _id: new ObjectId(),
      incidentId: oid,
      kind: patch.state as IncidentEventDoc["kind"],
      actor,
      note: patch.resolutionNote ?? null,
      at: new Date(),
    });
  }

  for (const k of ["severity", "impact", "commander", "resolutionNote"] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }

  await (await incidents()).updateOne({ _id: oid }, { $set: set });
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "incident.update", entity: "incident", entityId: id, before, after: set });
  return json({ success: true });
}

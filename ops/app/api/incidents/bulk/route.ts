import { z } from "zod";
import { ObjectId } from "mongodb";
import { incidentEvents, incidents } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";
import { scope } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(50),
  action: z.enum(["acknowledge", "monitor", "resolve"]),
  note: z.string().trim().max(1000).nullish(),
});

const NEXT: Record<string, string[]> = {
  open: ["acknowledged"],
  acknowledged: ["monitoring", "resolved"],
  monitoring: ["resolved"],
  resolved: ["open"],
};
const TARGET = { acknowledge: "acknowledged", monitor: "monitoring", resolve: "resolved" } as const;

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const target = TARGET[parsed.data.action];
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const raw of parsed.data.ids) {
    if (!ObjectId.isValid(raw)) {
      results.push({ id: raw, ok: false, error: "bad id" });
      continue;
    }
    const oid = new ObjectId(raw);
    const inc = await (await incidents()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
    if (!inc) {
      results.push({ id: raw, ok: false, error: "not found" });
      continue;
    }
    if (!(NEXT[inc.state] ?? []).includes(target)) {
      results.push({ id: raw, ok: false, error: `illegal ${inc.state} â†’ ${target}` });
      continue;
    }
    const set: Record<string, unknown> = { state: target, updatedAt: new Date() };
    if (target === "acknowledged" && !inc.ackAt) set.ackAt = new Date();
    if (target === "resolved") {
      set.resolvedAt = new Date();
      if (parsed.data.note) set.resolutionNote = parsed.data.note;
    }
    await (await incidents()).updateOne({ _id: oid }, { $set: set });
    await (await incidentEvents()).insertOne({
      _id: new ObjectId(),
      incidentId: oid,
      kind: target as "acknowledged" | "monitoring" | "resolved",
      actor: g.ctx.user.email,
      note: parsed.data.note ?? null,
      at: new Date(),
    });
    results.push({ id: raw, ok: true });
  }

  const ok = results.filter((r) => r.ok).length;
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: `incident.bulk_${parsed.data.action}`, entity: "incident", entityId: null, after: { requested: results.length, ok } });
  if (ok === 0) return fail("No transitions applied", 409, results.map((r) => ({ path: r.id, message: r.error ?? "" })));
  return json({ ok, failed: results.length - ok, results });
}

import { z } from "zod";
import { ObjectId } from "mongodb";
import { runbookRuns, runbooks } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";
import { scope } from "@/lib/scope";

const schema = z.object({
  status: z.enum(["ok", "failed", "partial"]),
  note: z.string().trim().max(2000).nullish(),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Runbook not found", 404);
  const rows = await (await runbookRuns())
    .find({ runbookId: new ObjectId(id), ...scope(g.ctx.user) } as never)
    .sort({ at: -1 })
    .limit(20)
    .toArray();
  return json({ items: rows.map((r) => ({ id: r._id.toHexString(), status: r.status, note: r.note, at: r.at })) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Runbook not found", 404);
  const rb = await (await runbooks()).findOne({ _id: new ObjectId(id), ...scope(g.ctx.user) } as never);
  if (!rb) return fail("Runbook not found", 404);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const doc = {
    _id: new ObjectId(),
    ownerId: g.ctx.user._id,
    runbookId: rb._id,
    actorId: g.ctx.user._id,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    at: new Date(),
  };
  await (await runbookRuns()).insertOne(doc);
  return json({ id: doc._id.toHexString() }, 201);
}

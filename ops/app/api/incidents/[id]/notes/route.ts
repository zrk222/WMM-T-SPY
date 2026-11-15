import { z } from "zod";
import { ObjectId } from "mongodb";
import { incidentEvents, incidents } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";

const schema = z.object({ note: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Incident not found", 404);
  const oid = new ObjectId(id);
  const inc = await (await incidents()).findOne({ _id: oid } as never);
  if (!inc) return fail("Incident not found", 404);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  await (await incidentEvents()).insertOne({
    _id: new ObjectId(),
    incidentId: oid,
    kind: "note",
    actor: g.ctx.user.email,
    note: parsed.data.note,
    at: new Date(),
  });
  return json({ success: true }, 201);
}

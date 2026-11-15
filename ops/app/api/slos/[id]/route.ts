import { ObjectId } from "mongodb";
import { slos } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json } from "@/lib/http";
import { scope } from "@/lib/scope";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("SLO not found", 404);
  const res = await (await slos()).deleteOne({ _id: new ObjectId(id), ...scope(g.ctx.user) } as never);
  return res.deletedCount ? json({ success: true }) : fail("SLO not found", 404);
}

import { ObjectId } from "mongodb";
import { runbooks } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { fail, json } from "@/lib/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Runbook not found", 404);
  const rb = await (await runbooks()).findOne({ _id: new ObjectId(id), ...scope(g.ctx.user) } as never);
  if (!rb) return fail("Runbook not found", 404);
  return json({ id, name: rb.name, serviceId: rb.serviceId?.toHexString() ?? null, steps: rb.steps });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Runbook not found", 404);
  const res = await (await runbooks()).deleteOne({ _id: new ObjectId(id), ...scope(g.ctx.user) } as never);
  return res.deletedCount ? json({ success: true }) : fail("Runbook not found", 404);
}

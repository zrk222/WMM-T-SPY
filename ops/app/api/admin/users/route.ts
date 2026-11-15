import { ObjectId } from "mongodb";
import { users } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { json } from "@/lib/http";
import { PLAN_ORDER, type Plan } from "@/lib/plans";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin"]);
  if (!g.ok) return g.response;
  const rows = await (await users()).find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return json({
    items: rows.map((u) => ({
      id: u._id.toHexString(),
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.plan,
      locked: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
      createdAt: u.createdAt,
    })),
    plans: PLAN_ORDER,
  });
}

const schema = z.object({ plan: z.enum(["free", "team", "scale"]).optional(), role: z.enum(["admin", "operator", "viewer"]).optional() });

export async function PATCH(req: Request) {
  const g = await gate(req, ["admin"], { writeScope: true });
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) return json({ error: "Missing id" }, 400);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const before = await (await users()).findOne({ _id: new ObjectId(id) });
  if (!before) return json({ error: "User not found" }, 404);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.plan) set.plan = parsed.data.plan satisfies Plan;
  if (parsed.data.role) set.role = parsed.data.role;
  await (await users()).updateOne({ _id: before._id }, { $set: set });
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "admin.user_update", entity: "user", entityId: id, before: { plan: before.plan, role: before.role }, after: set });
  return json({ success: true });
}

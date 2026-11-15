import { ObjectId } from "mongodb";
import { users } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { json, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";
import { PLAN_ORDER } from "@/lib/plans";

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
      banned: Boolean(u.bannedAt),
      locked: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
      createdAt: u.createdAt,
    })),
    plans: PLAN_ORDER,
  });
}

const schema = z.object({
  plan: z.enum(["free", "team", "scale"]).optional(),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
  banned: z.boolean().optional(),
});

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

  const isSelf = before._id.equals(g.ctx.user._id);
  if (parsed.data.role && parsed.data.role !== "admin" && before.role === "admin") {
    const admins = await (await users()).countDocuments({ role: "admin", bannedAt: null });
    if (admins <= 1) return json({ error: "Cannot demote the last admin" }, 409);
  }
  if (parsed.data.banned === true && isSelf) return json({ error: "Cannot suspend yourself" }, 409);
  if (parsed.data.banned === false && before.bannedAt) {
    await (await users()).updateOne({ _id: before._id }, { $set: { failedLogins: 0, lockedUntil: null } });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.plan) set.plan = parsed.data.plan;
  if (parsed.data.role) set.role = parsed.data.role;
  if (parsed.data.banned !== undefined) set.bannedAt = parsed.data.banned ? new Date() : null;
  if (parsed.data.banned !== undefined) set.tv = before.tv + 1;

  await (await users()).updateOne({ _id: before._id }, { $set: set });
  await recordAudit({
    actor: g.ctx.user._id.toHexString(),
    action: "admin.user_update",
    entity: "user",
    entityId: id,
    before: { plan: before.plan, role: before.role, banned: Boolean(before.bannedAt) },
    after: set,
  });
  return json({ success: true });
}

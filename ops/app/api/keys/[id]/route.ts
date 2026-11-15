import { ObjectId } from "mongodb";
import { apiKeys } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Key not found", 404);
  const res = await (await apiKeys()).findOneAndUpdate(
    { _id: new ObjectId(id), userId: g.ctx.user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (!res) return fail("Key not found", 404);
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "apikey.revoke", entity: "api_key", entityId: id });
  return json({ success: true });
}

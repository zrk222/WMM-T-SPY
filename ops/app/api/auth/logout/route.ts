import { authenticate, endSession } from "@/lib/auth";
import { json } from "@/lib/http";
import { recordAudit } from "@/lib/audit";
import { users } from "@/lib/collections";

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const { user } = auth.ctx;
  await (await users()).updateOne({ _id: user._id }, { $inc: { tv: 1 }, $set: { updatedAt: new Date() } });
  await endSession();
  await recordAudit({ actor: user._id.toHexString(), action: "user.logout", entity: "user", entityId: user._id.toHexString() });
  return json({ success: true });
}

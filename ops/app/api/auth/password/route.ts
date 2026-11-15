import { z } from "zod";
import { authenticate, hashPassword } from "@/lib/auth";
import { users } from "@/lib/collections";
import { json, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ current: z.string().min(1), next: z.string().min(10).max(200) });

export async function PATCH(req: Request) {
  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const { compare } = await import("bcryptjs");
  if (!(await compare(parsed.data.current, auth.ctx.user.passwordHash))) {
    return json({ error: "Current password is incorrect" }, 400);
  }
  await (await users()).updateOne(
    { _id: auth.ctx.user._id },
    { $set: { passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() }, $inc: { tv: 1 } },
  );
  await recordAudit({ actor: auth.ctx.user._id.toHexString(), action: "user.password", entity: "user", entityId: auth.ctx.user._id.toHexString() });
  return json({ success: true });
}

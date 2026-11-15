import { z } from "zod";
import { users } from "@/lib/collections";
import { LOCK_AFTER, LOCK_MS, publicUser, startSession, verifyPassword } from "@/lib/auth";
import { fail, json, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const rl = rateLimit(req, { read: 120, write: 80 });
  if (!rl.ok) return fail("Rate limit exceeded", 429);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const user = await (await users()).findOne({ email: parsed.data.email });
  if (!user) return fail("Invalid credentials", 401);
  if (user.bannedAt) return json({ error: "Account suspended", banned: true }, 403);

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    return json({ error: "Account locked", locked: true, remainingTime: seconds }, 423);
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lockedUntil = failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS) : null;
    await (await users()).updateOne(
      { _id: user._id },
      { $set: { failedLogins: lockedUntil ? 0 : failed, lockedUntil, updatedAt: new Date() } },
    );
    return json(
      { error: "Invalid credentials", attemptsRemaining: Math.max(LOCK_AFTER - failed, 0), locked: Boolean(lockedUntil) },
      401,
    );
  }

  const fresh = { ...user, failedLogins: 0, lockedUntil: null };
  await (await users()).updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null, updatedAt: new Date() } });
  await startSession(fresh);
  await recordAudit({ actor: user._id.toHexString(), action: "user.login", entity: "user", entityId: user._id.toHexString() });
  return json({ user: publicUser(fresh) });
}

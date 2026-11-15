import { z } from "zod";
import { ObjectId } from "mongodb";
import { users } from "@/lib/collections";
import { hashPassword, publicUser, startSession } from "@/lib/auth";
import { fail, json, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
});

export async function POST(req: Request) {
  const rl = rateLimit(req, { read: 120, write: 200 });
  if (!rl.ok) return fail("Rate limit exceeded", 429);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { name, email, password } = parsed.data;

  const existing = await (await users()).findOne({ email });
  if (existing) return fail("Email already registered", 409);

  const first = (await (await users()).countDocuments({})) === 0;
  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    email,
    name,
    passwordHash: await hashPassword(password),
    role: first ? ("admin" as const) : ("operator" as const),
    plan: first ? ("scale" as const) : ("free" as const),
    bannedAt: null,
    tv: 0,
    lockedUntil: null,
    failedLogins: 0,
    createdAt: now,
    updatedAt: now,
  };
  await (await users()).insertOne(doc);
  await startSession(doc);
  await recordAudit({ actor: doc._id.toHexString(), action: "user.signup", entity: "user", entityId: doc._id.toHexString(), after: { email } });
  return json({ user: publicUser(doc) }, 201);
}

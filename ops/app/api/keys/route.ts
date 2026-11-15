import { z } from "zod";
import { ObjectId } from "mongodb";
import { apiKeys, type ApiKeyDoc } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";
import { MAX_KEYS, newKey } from "@/lib/api-keys";
import { limitsFor } from "@/lib/plans";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  scopes: z.array(z.enum(["ops:read", "ops:write"])).min(1).default(["ops:read"]),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const rows = await (await apiKeys()).find({ userId: g.ctx.user._id, revokedAt: null }).sort({ createdAt: -1 }).toArray();
  return json({
    items: rows.map((k) => ({ id: k._id.toHexString(), name: k.name, prefix: k.prefix, scopes: k.scopes, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })),
    max: Math.min(limitsFor(g.ctx.user.plan).apiKeys, MAX_KEYS),
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"], { writeScope: true });
  if (!g.ok) return g.response;

  const count = await (await apiKeys()).countDocuments({ userId: g.ctx.user._id, revokedAt: null });
  const cap = Math.min(limitsFor(g.ctx.user.plan).apiKeys, MAX_KEYS);
  if (cap !== -1 && count >= cap) return fail(`API key limit reached (${cap})`, 409);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const scopes = parsed.data.scopes ?? ["ops:read"];
  if (scopes.includes("ops:write") && !limitsFor(g.ctx.user.plan).mcpWrite) {
    return fail("ops:write requires the Team plan", 403);
  }

  const { secret, prefix, hash } = newKey();
  const doc: ApiKeyDoc = {
    _id: new ObjectId(),
    userId: g.ctx.user._id,
    name: parsed.data.name,
    prefix,
    keyHash: hash,
    scopes,
    lastUsedAt: null,
    createdAt: new Date(),
    revokedAt: null,
  };
  await (await apiKeys()).insertOne(doc);
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "apikey.create", entity: "api_key", entityId: doc._id.toHexString(), after: { name: doc.name, scopes } });
  return json({ id: doc._id.toHexString(), key: secret, prefix, scopes, shownOnce: true }, 201);
}

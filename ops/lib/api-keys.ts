import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { apiKeys, users, type UserDoc } from "./collections";

export const KEY_PREFIX = "ck_";
export const MAX_KEYS = 5;

export function newKey() {
  const secret = KEY_PREFIX + randomBytes(16).toString("hex");
  return { secret, prefix: secret.slice(0, 11), hash: hashKey(secret) };
}

export function hashKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export type KeyAuth = { user: UserDoc; keyId: string; scopes: string[] };

export async function authenticateKey(req: Request): Promise<KeyAuth | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const secret = header.slice(7).trim();
  if (!secret.startsWith(KEY_PREFIX)) return null;
  const row = await (await apiKeys()).findOne({ keyHash: hashKey(secret), revokedAt: null });
  if (!row) return null;
  const user = await (await users()).findOne({ _id: row.userId });
  if (!user) return null;
  void (await apiKeys()).updateOne({ _id: row._id }, { $set: { lastUsedAt: new Date() } });
  return { user, keyId: row._id.toHexString(), scopes: row.scopes };
}

export function asObjectId(v: string): ObjectId | null {
  return ObjectId.isValid(v) ? new ObjectId(v) : null;
}

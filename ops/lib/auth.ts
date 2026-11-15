import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { users, type Role, type UserDoc } from "./collections";
import { env } from "./env";
import { fail } from "./http";

const COOKIE = "token";
const CSRF_COOKIE = "csrf";
const key = () => new TextEncoder().encode(env.jwtSecret);

export const BCRYPT_ROUNDS = 10;

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function signToken(user: Pick<UserDoc, "_id" | "email" | "name" | "role" | "tv">) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role, tv: user.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user._id.toHexString())
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function startSession(user: Pick<UserDoc, "_id" | "email" | "name" | "role" | "tv">) {
  const token = await signToken(user);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  jar.set(CSRF_COOKIE, crypto.randomUUID(), {
    httpOnly: false,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(CSRF_COOKIE);
}

export type AuthContext = { user: UserDoc; via: "cookie" | "bearer" };

export async function currentUser(): Promise<UserDoc | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub || !ObjectId.isValid(payload.sub)) return null;
    const user = await (await users()).findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return null;
    if (user.bannedAt) return null;
    if ((payload.tv as number | undefined) !== user.tv) return null;
    return user;
  } catch {
    return null;
  }
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export async function authenticate(req: Request): Promise<{ ok: true; ctx: AuthContext } | { ok: false; response: Response }> {
  const user = await currentUser();
  if (!user) return { ok: false, response: fail("Authentication required", 401) };
  if (MUTATING.has(req.method)) {
    const jar = await cookies();
    const expected = jar.get(CSRF_COOKIE)?.value;
    const got = req.headers.get("x-csrf");
    if (!expected || !got || expected !== got) {
      return { ok: false, response: fail("CSRF token missing or invalid", 403) };
    }
  }
  return { ok: true, ctx: { user, via: "cookie" } };
}

export async function requireRole(roles: Role[]): Promise<{ ok: true; user: UserDoc } | { ok: false; response: Response }> {
  const user = await currentUser();
  if (!user) return { ok: false, response: fail("Authentication required", 401) };
  if (!roles.includes(user.role)) return { ok: false, response: fail("Insufficient role", 403) };
  return { ok: true, user };
}

export function publicUser(u: UserDoc) {
  return {
    id: u._id.toHexString(),
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    banned: Boolean(u.bannedAt),
    createdAt: u.createdAt,
  };
}

export const LOCK_AFTER = 5;
export const LOCK_MS = 15 * 60 * 1000;

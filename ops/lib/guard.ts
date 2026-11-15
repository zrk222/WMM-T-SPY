import { authenticateKey, type KeyAuth } from "./api-keys";
import { authenticate, type AuthContext } from "./auth";
import { limitsFor, within } from "./plans";
import type { UserDoc } from "./collections";
import { fail } from "./http";
import { rateLimit, type Limit } from "./rate-limit";

export type Ctx = { user: UserDoc; via: "cookie" | "bearer"; scopes?: string[] };

export async function gate(
  req: Request,
  roles: readonly ("admin" | "operator" | "viewer")[],
  opts: { limit?: Limit; writeScope?: boolean } = {},
): Promise<{ ok: true; ctx: Ctx } | { ok: false; response: Response }> {
  const rl = rateLimit(req, opts.limit);
  if (!rl.ok) {
    const res = fail("Rate limit exceeded", 429);
    res.headers.set("retry-after", String(rl.retryAfter));
    return { ok: false, response: res };
  }

  let ctx: Ctx | null = null;
  const keyed: KeyAuth | null = await authenticateKey(req);
  if (keyed) {
    const needed = opts.writeScope ? "ops:write" : "ops:read";
    if (!keyed.scopes.includes(needed)) {
      return { ok: false, response: fail(`API key lacks ${needed}`, 403) };
    }
    ctx = { user: keyed.user, via: "bearer", scopes: keyed.scopes };
  } else {
    const cookieAuth: { ok: true; ctx: AuthContext } | { ok: false; response: Response } = await authenticate(req);
    if (!cookieAuth.ok) return { ok: false, response: cookieAuth.response };
    ctx = { user: cookieAuth.ctx.user, via: "cookie" };
  }

  if (!roles.includes(ctx.user.role)) return { ok: false, response: fail("Insufficient role", 403) };
  return { ok: true, ctx };
}

export async function quota(
  user: UserDoc,
  kind: "services" | "openIncidents" | "runbooks" | "slos" | "apiKeys",
  current: number,
) {
  const limit = limitsFor(user.plan)[kind];
  return within(limit, current) ? null : fail(`Plan limit reached for ${kind}`, 403);
}

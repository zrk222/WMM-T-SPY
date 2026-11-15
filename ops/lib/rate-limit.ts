const WINDOW_MS = 60_000;
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type Limit = { read: number; write: number };

export const DEFAULT_LIMITS: Limit = { read: 120, write: 30 };
const FACTOR = Number(process.env.RATE_LIMIT_MULTIPLIER ?? 1);
const scale = (n: number) => Math.max(1, Math.round(n * (Number.isFinite(FACTOR) && FACTOR > 0 ? FACTOR : 1)));

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function rateLimit(req: Request, limit: Limit = DEFAULT_LIMITS) {
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  return rateLimitExact(req, write ? scale(limit.write) : scale(limit.read));
}

export function rateLimitExact(req: Request, max: number) {
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const key = `${clientIp(req)}:${write ? "w" : "r"}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true as const, remaining: max - 1 };
  }
  if (b.count >= max) {
    return { ok: false as const, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true as const, remaining: max - b.count };
}

export function resetRateLimits() {
  buckets.clear();
}

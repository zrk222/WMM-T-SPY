import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const id = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const started = Date.now();

  const res = NextResponse.next({ request: { headers: new Headers(req.headers) } });
  res.headers.set("x-request-id", id);

  const line = JSON.stringify({
    t: new Date().toISOString(),
    id,
    m: req.method,
    p: req.nextUrl.pathname,
    q: req.nextUrl.search || undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    ua: req.headers.get("user-agent")?.slice(0, 80),
  });
  console.log(`${line} ms=${Date.now() - started}`);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

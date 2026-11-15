import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

export type ErrBody = { error: string; issues?: { path: string; message: string }[] };

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, issues?: ErrBody["issues"]) {
  return NextResponse.json({ error: message, ...(issues ? { issues } : {}) }, { status });
}

export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail("Validation failed", 400, [{ path: "", message: "Request body must be valid JSON" }]) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail(
        "Validation failed",
        400,
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function zodIssues(e: unknown) {
  if (e instanceof ZodError) return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return undefined;
}

export function pageParams(url: URL, maxSize = 50) {
  const cursor = url.searchParams.get("cursor");
  const raw = Number(url.searchParams.get("pageSize") ?? 20);
  const pageSize = Math.min(Math.max(Number.isFinite(raw) ? raw : 20, 1), maxSize);
  return { cursor, pageSize };
}

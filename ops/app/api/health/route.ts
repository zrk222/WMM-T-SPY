import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await (await getDb()).command({ ping: 1 });
    return Response.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}

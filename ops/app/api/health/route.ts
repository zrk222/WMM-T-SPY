import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const base = { time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    if (!deep) return Response.json({ status: "ok", db: "up", ...base });
    const [users, services, incidents] = await Promise.all([
      db.collection("users").estimatedDocumentCount(),
      db.collection("services").estimatedDocumentCount(),
      db.collection("incidents").estimatedDocumentCount(),
    ]);
    return Response.json({ status: "ok", db: "up", ready: true, counts: { users, services, incidents }, ...base });
  } catch {
    return Response.json({ status: "degraded", db: "down", ready: false, ...base }, { status: 503 });
  }
}

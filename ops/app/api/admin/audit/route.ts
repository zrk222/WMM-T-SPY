import { getDb } from "@/lib/db";
import { gate } from "@/lib/guard";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin"]);
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const rows = await (await getDb()).collection("audit").find({}).sort({ at: -1 }).limit(url.searchParams.get("format") === "csv" ? 5000 : 200).toArray();
  if (url.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, `"""`)}"`;
    const head = "at,actor,action,entity,entityId";
    const lines = rows.map((r) => [r.at?.toISOString?.() ?? "", r.actor, r.action, r.entity, r.entityId].map(esc).join(","));
    return new Response([head, ...lines].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="audit.csv"` } });
  }
  return json({ items: rows.map((r) => ({ ...r, _id: String(r._id) })) });
}

import { getDb } from "@/lib/db";
import { gate } from "@/lib/guard";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin"]);
  if (!g.ok) return g.response;
  const rows = await (await getDb()).collection("audit").find({}).sort({ at: -1 }).limit(200).toArray();
  return json({ items: rows.map((r) => ({ ...r, _id: String(r._id) })) });
}

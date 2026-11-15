import { incidents, services } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { json } from "@/lib/http";
import { scope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return json({ services: [], incidents: [] });

  const owned = scope(g.ctx.user);
  const [svc, inc] = await Promise.all([
    (await services()).find({ ...owned, $text: { $search: q } } as never).limit(10).toArray(),
    (await incidents()).find({ ...owned, title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } as never).limit(10).toArray(),
  ]);

  return json({
    services: svc.map((s) => ({ id: s._id.toHexString(), name: s.name, tier: s.tier })),
    incidents: inc.map((i) => ({ id: i._id.toHexString(), title: i.title, state: i.state, severity: i.severity })),
  });
}

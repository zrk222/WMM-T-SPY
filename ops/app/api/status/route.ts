import { getDb } from "@/lib/db";
import { incidents, services, slos } from "@/lib/collections";

export const dynamic = "force-dynamic";

/** Public, unauthenticated status: service state + open incidents, no emails. */
export async function GET() {
  const db = await getDb();
  void db;
  const [svc, open, sloRows] = await Promise.all([
    (await services()).find({}).sort({ tier: 1, name: 1 }).toArray(),
    (await incidents()).find({ state: { $ne: "resolved" } }).sort({ openedAt: -1 }).toArray(),
    (await slos()).find({}).toArray(),
  ]);
  const byService = new Map<string, typeof open>();
  for (const i of open) {
    const k = i.serviceId.toHexString();
    byService.set(k, [...(byService.get(k) ?? []), i]);
  }
  const sloByService = new Map(sloRows.map((s) => [s.serviceId.toHexString(), s]));

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      services: svc.map((s) => {
        const inc = byService.get(s._id.toHexString()) ?? [];
        const worst = inc.sort((a, b) => a.severity.localeCompare(b.severity))[0];
        return {
          name: s.name,
          tier: s.tier,
          state: worst ? "degraded" : "operational",
          severity: worst?.severity ?? null,
          slo: sloByService.get(s._id.toHexString())?.target ?? null,
          openIncidents: inc.length,
        };
      }),
      summary: {
        services: svc.length,
        degraded: byService.size,
        openIncidents: open.length,
      },
    },
    { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=30" } },
  );
}

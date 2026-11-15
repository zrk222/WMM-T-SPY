import { incidents, runbookRuns, services, slos } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { errorBudget } from "@/lib/slo";
import { scope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;

  const owned = scope(g.ctx.user);
  const [open, resolved, all, svc, sloRows, runs] = await Promise.all([
    (await incidents()).find(owned as never).toArray(),
    (await incidents()).countDocuments({ ...owned, state: "resolved" }),
    (await incidents()).countDocuments(owned),
    (await services()).countDocuments(owned),
    (await slos()).find(owned as never).toArray(),
    (await runbookRuns()).countDocuments(owned),
  ]);

  const unresolved = open.filter((i) => i.state !== "resolved");
  const bySeverity = unresolved.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {});

  const resolvedRows = await (await incidents()).find({ ...owned, state: "resolved", resolvedAt: { $ne: null } }).project({ openedAt: 1, resolvedAt: 1 }).toArray();
  const mttrMinutes = resolvedRows.length
    ? resolvedRows.reduce((sum, r) => sum + ((r.resolvedAt as Date).getTime() - r.openedAt.getTime()) / 60000, 0) / resolvedRows.length
    : 0;

  const budgets = await Promise.all(sloRows.map((s) => errorBudget(s.serviceId, s.target, s.windowDays)));

  const metrics = {
    services: svc,
    incidents: { total: all, open: unresolved.length, resolved },
    openBySeverity: bySeverity,
    mttrMinutes: Math.round(mttrMinutes * 100) / 100,
    slos: {
      total: sloRows.length,
      exhausted: budgets.filter((b) => b.state === "exhausted").length,
      warning: budgets.filter((b) => b.state === "warning").length,
    },
    runbookRuns: runs,
    generatedAt: new Date().toISOString(),
  };

  if (new URL(req.url).searchParams.get("format") === "prom") {
    const lines = [
      "# TYPE cloudops_services gauge",
      `cloudops_services ${metrics.services}`,
      "# TYPE cloudops_incidents_open gauge",
      `cloudops_incidents_open ${metrics.incidents.open}`,
      "# TYPE cloudops_incidents_resolved_total counter",
      `cloudops_incidents_resolved_total ${metrics.incidents.resolved}`,
      "# TYPE cloudops_mttr_minutes gauge",
      `cloudops_mttr_minutes ${metrics.mttrMinutes}`,
      "# TYPE cloudops_slo_exhausted gauge",
      `cloudops_slo_exhausted ${metrics.slos.exhausted}`,
      ...Object.entries(bySeverity).map(([sev, n]) => `cloudops_incidents_open_severity{severity="${sev}"} ${n}`),
      "",
    ];
    return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; version=0.0.4" } });
  }

  return Response.json(metrics);
}

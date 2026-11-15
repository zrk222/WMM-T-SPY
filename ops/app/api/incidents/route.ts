import { z } from "zod";
import { ObjectId } from "mongodb";
import { incidentEvents, incidents, services } from "@/lib/collections";
import { gate, quota } from "@/lib/guard";
import { deliverAlert } from "@/lib/alerts";
import { scope } from "@/lib/scope";
import { applyCursor, decodeCursor, encodeCursor } from "@/lib/cursor";
import { fail, json, pageParams, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  serviceId: z.string().min(1),
  title: z.string().trim().min(4).max(200),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4"]).default("sev3"),
  impact: z.enum(["critical", "major", "minor", "none"]).default("minor"),
  commander: z.string().trim().max(120).nullish(),
});

export const dynamic = "force-dynamic";

const csv = (v: string) => `"${v.replace(/"/g, `"""`).replace(/\n/g, " ")}"`;

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;

  const url = new URL(req.url);
  const { cursor, pageSize } = pageParams(url);
  const state = url.searchParams.get("state");
  const severity = url.searchParams.get("severity");
  const serviceId = url.searchParams.get("serviceId");

  const base: Record<string, unknown> = {};
  if (state) base.state = state;
  if (severity) base.severity = severity;
  if (serviceId && ObjectId.isValid(serviceId)) base.serviceId = new ObjectId(serviceId);
  if (url.searchParams.get("open") === "1") base.state = { $ne: "resolved" };

  const filter = applyCursor(scope(g.ctx.user, base), decodeCursor(cursor));
  const rows = await (await incidents())
    .find(filter as never)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .toArray();

  const svcIds = [...new Set(rows.map((r) => r.serviceId.toHexString()))];
  const svcRows = await (await services()).find({ _id: { $in: svcIds.map((s) => new ObjectId(s)) } }).toArray();
  const names = new Map(svcRows.map((s) => [s._id.toHexString(), s.name]));

  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);

  if (url.searchParams.get("format") === "csv") {
    const head = "id,service,title,severity,state,impact,openedAt,resolvedAt";
    const lines = page.map((i) => [i._id.toHexString(), csv(names.get(i.serviceId.toHexString()) ?? ""), csv(i.title), i.severity, i.state, i.impact, i.openedAt.toISOString(), i.resolvedAt?.toISOString() ?? ""].join(","));
    return new Response([head, ...lines].join("\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="incidents.csv"` },
    });
  }


  return json({
    items: page.map((i) => ({
      id: i._id.toHexString(),
      serviceId: i.serviceId.toHexString(),
      serviceName: names.get(i.serviceId.toHexString()) ?? "unknown",
      title: i.title,
      severity: i.severity,
      state: i.state,
      impact: i.impact,
      openedAt: i.openedAt,
    })),
    nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1]._id.toHexString()) : null,
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;

  const openCount = await (await incidents()).countDocuments(scope(g.ctx.user, { state: { $ne: "resolved" } }));
  const over = await quota(g.ctx.user, "openIncidents", openCount);
  if (over) return over;

  const parsed = await parseBody(req, createSchema);
  if (!parsed.ok) return parsed.response;
  if (!ObjectId.isValid(parsed.data.serviceId)) return fail("Unknown serviceId", 400);
  const svc = await (await services()).findOne({ _id: new ObjectId(parsed.data.serviceId), ...scope(g.ctx.user) } as never);
  if (!svc) return fail("Unknown serviceId", 400);

  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    ownerId: g.ctx.user._id,
    serviceId: svc._id,
    title: parsed.data.title,
    severity: parsed.data.severity ?? "sev3",
    state: "open" as const,
    impact: parsed.data.impact ?? "minor",
    commander: parsed.data.commander ?? null,
    openedBy: g.ctx.user.email,
    openedAt: now,
    ackAt: null,
    resolvedAt: null,
    resolutionNote: null,
    postmortem: null,
    createdAt: now,
    updatedAt: now,
  };
  await (await incidents()).insertOne(doc);
  await (await incidentEvents()).insertOne({
    _id: new ObjectId(),
    incidentId: doc._id,
    kind: "opened",
    actor: g.ctx.user.email,
    note: null,
    at: now,
  });
  void deliverAlert(doc, g.ctx.user._id);
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "incident.open", entity: "incident", entityId: doc._id.toHexString(), after: doc });
  return json({ id: doc._id.toHexString() }, 201);
}

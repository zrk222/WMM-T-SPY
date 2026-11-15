import Link from "next/link";
import { incidents, services } from "@/lib/collections";
import { currentUser } from "@/lib/auth";
import { scope } from "@/lib/scope";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { NewIncident } from "./new-incident";
import { IncidentTable } from "./incident-table";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; severity?: string; serviceId?: string; cursor?: string }>;
}) {
  const { state, severity, serviceId, cursor } = await searchParams;
  const user = (await currentUser())!;

  const base: Record<string, unknown> = scope(user);
  if (state && state !== "all") base.state = state;
  if (!state) base.state = { $ne: "resolved" };
  if (severity) base.severity = severity;
  if (serviceId) base.serviceId = serviceId as never;

  const cur = decodeCursor(cursor ?? null);
  const filter = cur
    ? { ...base, $or: [{ createdAt: { $lt: new Date(cur.c) } }, { createdAt: new Date(cur.c), _id: { $lt: cur.i as never } }] }
    : base;

  const PAGE = 25;
  const rows = await (await incidents()).find(filter as never).sort({ createdAt: -1, _id: -1 }).limit(PAGE + 1).toArray();
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const names = new Map((await (await services()).find(scope(user) as never).toArray()).map((s) => [s._id.toHexString(), s.name]));

  const qs = new URLSearchParams();
  if (state) qs.set("state", state);
  if (severity) qs.set("severity", severity);
  if (serviceId) qs.set("serviceId", serviceId);
  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams(qs);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/incidents?${p.toString()}`;
  };
  const next = hasMore && page.length ? link({ cursor: encodeCursor(page[page.length - 1].createdAt, page[page.length - 1]._id.toHexString()) }) : null;
  const csvHref = `/api/incidents?format=csv&pageSize=50${severity ? `&severity=${severity}` : ""}${state ? `&state=${state}` : ""}`;

  return (
    <>
      <div className="row">
        <div>
          <h1>Incidents</h1>
          <p className="lead">open → acknowledged → monitoring → resolved</p>
        </div>
        <span className="spacer" />
        <Link href={csvHref}>
          <button className="ghost">Export CSV</button>
        </Link>
        {user.role !== "viewer" && <NewIncident />}
      </div>

      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <select name="state" defaultValue={state ?? ""}>
          <option value="">open work</option>
          <option value="all">all</option>
          <option value="acknowledged">acknowledged</option>
          <option value="monitoring">monitoring</option>
          <option value="resolved">resolved</option>
        </select>
        <select name="severity" defaultValue={severity ?? ""}>
          <option value="">any severity</option>
          <option value="sev1">sev1</option>
          <option value="sev2">sev2</option>
          <option value="sev3">sev3</option>
          <option value="sev4">sev4</option>
        </select>
        <select name="serviceId" defaultValue={serviceId ?? ""}>
          <option value="">any service</option>
          {[...names.entries()].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="ghost" type="submit">
          Apply
        </button>
        <Link href="/incidents" className="muted">
          Reset
        </Link>
      </form>

      <IncidentTable
        rows={page.map((i) => ({
          id: i._id.toHexString(),
          severity: i.severity,
          state: i.state,
          title: i.title,
          serviceName: names.get(i.serviceId.toHexString()) ?? "—",
          openedAt: i.openedAt.toISOString().slice(0, 16).replace("T", " "),
        }))}
      />

      {next && (
        <p style={{ marginTop: 14 }}>
          <Link href={next}>Next page →</Link>
        </p>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth";
import { incidentEvents, incidents, services } from "@/lib/collections";
import { IncidentActions } from "./actions";

export const dynamic = "force-dynamic";

const NEXT: Record<string, string[]> = {
  open: ["acknowledged"],
  acknowledged: ["monitoring", "resolved"],
  monitoring: ["resolved"],
  resolved: ["open"],
};

export default async function IncidentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const oid = new ObjectId(id);
  const user = (await currentUser())!;
  const inc = await (await incidents()).findOne({ _id: oid });
  if (!inc) notFound();
  const svc = await (await services()).findOne({ _id: inc.serviceId });
  const events = await (await incidentEvents()).find({ incidentId: oid }).sort({ at: 1 }).toArray();

  return (
    <>
      <p className="muted">
        <Link href="/incidents">← Incidents</Link>
      </p>
      <h1>
        <span className={`pill ${inc.severity}`}>{inc.severity}</span> {inc.title}
      </h1>
      <p className="lead">
        {svc ? <Link href={`/services/${svc._id.toHexString()}`}>{svc.name}</Link> : "unknown service"} · state{" "}
        <span className={`pill ${inc.state}`}>{inc.state}</span> · impact {inc.impact}
        {inc.commander ? ` · commander ${inc.commander}` : ""}
      </p>

      <h2>Timeline</h2>
      <div className="panel">
        {events.map((e) => (
          <div key={e._id.toHexString()} style={{ marginBottom: 8 }}>
            <span className="mono muted">{e.at.toISOString().slice(11, 19)}</span> <strong>{e.kind}</strong>{" "}
            <span className="muted">{e.actor}</span>
            {e.note && <div>{e.note}</div>}
          </div>
        ))}
      </div>

      {user.role !== "viewer" && (
        <div style={{ marginTop: 14 }}>
          <IncidentActions id={id} allowed={NEXT[inc.state] ?? []} />
        </div>
      )}
    </>
  );
}

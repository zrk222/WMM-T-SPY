import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth";
import { deploys, incidents, services, slos } from "@/lib/collections";
import { NewIncident } from "@/app/(app)/incidents/new-incident";
import { SloForm } from "./slo-form";

export const dynamic = "force-dynamic";

export default async function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const oid = new ObjectId(id);
  const user = (await currentUser())!;
  const svc = await (await services()).findOne({ _id: oid });
  if (!svc) notFound();

  const [open, dep, slo] = await Promise.all([
    (await incidents()).find({ serviceId: oid }).sort({ openedAt: -1 }).limit(10).toArray(),
    (await deploys()).find({ serviceId: oid }).sort({ at: -1 }).limit(10).toArray(),
    (await slos()).findOne({ serviceId: oid }),
  ]);

  return (
    <>
      <p className="muted">
        <Link href="/services">← Services</Link>
      </p>
      <h1>{svc.name}</h1>
      <p className="lead">
        tier {svc.tier} · {svc.owner || "no owner"} · {svc.tags.join(", ") || "no tags"}
      </p>
      {svc.description && <p>{svc.description}</p>}

      <h2>Incidents</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>State</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {open.map((i) => (
            <tr key={i._id.toHexString()}>
              <td>
                <span className={`pill ${i.severity}`}>{i.severity}</span>
              </td>
              <td>
                <span className={`pill ${i.state}`}>{i.state}</span>
              </td>
              <td>
                <Link href={`/incidents/${i._id.toHexString()}`}>{i.title}</Link>
              </td>
            </tr>
          ))}
          {open.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No incidents.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {user.role !== "viewer" && (
        <div style={{ marginTop: 12 }}>
          <NewIncident serviceId={id} />
        </div>
      )}

      <div className="grid cols2">
        <div>
          <h2>SLO</h2>
          {slo ? (
            <div className="panel">
              <p>
                {slo.target}% over {slo.windowDays}d ({slo.indicator})
              </p>
            </div>
          ) : (
            <p className="muted">No SLO set.</p>
          )}
          {user.role !== "viewer" && <SloForm serviceId={id} />}
        </div>
        <div>
          <h2>Deploys</h2>
          <div className="panel mono">
            {dep.map((d) => (
              <div key={d._id.toHexString()} className="muted">
                {d.at.toISOString().slice(0, 16)} {d.version} · {d.environment} · {d.status}
              </div>
            ))}
            {dep.length === 0 && <span className="muted">None.</span>}
          </div>
        </div>
      </div>
    </>
  );
}

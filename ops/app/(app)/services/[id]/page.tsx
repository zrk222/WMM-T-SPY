import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { currentUser } from "@/lib/auth";
import { deploys, incidents, services, slos } from "@/lib/collections";
import { NewIncident } from "@/app/(app)/incidents/new-incident";
import { SloForm } from "./slo-form";
import { BudgetBar } from "./budget";
import { errorBudget } from "@/lib/slo";
import { scope } from "@/lib/scope";
import { DeployForm } from "./deploy-form";
import { ServiceActions } from "./service-actions";
import { dependentsOf, dependenciesOf, mttrFor } from "@/lib/graph";

export const dynamic = "force-dynamic";

export default async function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const oid = new ObjectId(id);
  const user = (await currentUser())!;
  const svc = await (await services()).findOne({ _id: oid });
  if (!svc) notFound();

  const [open, dep, slo, deps, dependents, mttr] = await Promise.all([
    (await incidents()).find({ serviceId: oid }).sort({ openedAt: -1 }).limit(10).toArray(),
    (await deploys()).find({ serviceId: oid }).sort({ at: -1 }).limit(10).toArray(),
    (await slos()).findOne({ serviceId: oid }),
    dependenciesOf(oid),
    dependentsOf(oid),
    mttrFor(oid),
  ]);

  return (
    <>
      <p className="muted">
        <Link href="/services">â† Services</Link>
      </p>
      <h1>{svc.name}</h1>
      <p className="lead">
        tier {svc.tier} Â· {svc.owner || "no owner"} Â· {svc.tags.join(", ") || "no tags"}
      </p>
      {svc.description && <p>{svc.description}</p>}
      <p className="muted mono">
        MTTR {mttr.minutes}m over {mttr.resolved} resolved
      </p>
      {(deps.length > 0 || dependents.length > 0) && (
        <div className="panel">
          <strong>Dependencies</strong>
          <div className="muted">depends on: {deps.map((d) => d.name).join(", ") || "—"}</div>
          <div className="muted">depended on by: {dependents.map((d) => d.name).join(", ") || "—"}</div>
        </div>
      )}
      {user.role !== "viewer" && (
        <ServiceActions service={{ id, name: svc.name, owner: svc.owner, description: svc.description, tier: svc.tier, dependencies: deps }}
          options={(await (await services()).find(scope(user) as never).toArray()).filter((x) => !x._id.equals(oid)).map((x) => ({ id: x._id.toHexString(), name: x.name }))} />
      )}

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
            <div>
              <p className="muted">
                {slo.target}% over {slo.windowDays}d ({slo.indicator})
              </p>
              <BudgetBar budget={await errorBudget(oid, slo.target, slo.windowDays)} />
            </div>
          ) : (
            <p className="muted">No SLO set.</p>
          )}
          {user.role !== "viewer" && <SloForm serviceId={id} sloId={slo?._id.toHexString()} />}
        </div>
        <div>
          <h2>Deploys</h2>
          <div className="panel mono">
            {dep.map((d) => (
              <div key={d._id.toHexString()} className="muted">
                {d.at.toISOString().slice(0, 16)} {d.version} Â· {d.environment} Â· {d.status}
              </div>
            ))}
            {dep.length === 0 && <span className="muted">None.</span>}
          </div>
          {user.role !== "viewer" && <DeployForm serviceId={id} />}
        </div>
      </div>
    </>
  );
}

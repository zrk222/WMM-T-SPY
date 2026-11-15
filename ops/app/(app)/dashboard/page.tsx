import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { audit, deploys, incidents, services, slos } from "@/lib/collections";
import { limitsFor } from "@/lib/plans";
import { scope } from "@/lib/scope";
import { errorBudget } from "@/lib/slo";
import { BudgetBar } from "@/app/(app)/services/[id]/budget";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await currentUser())!;
  const [svcCount, open, ackd, sloRows, recent, activity] = await Promise.all([
    (await services()).countDocuments(scope(user)),
    (await incidents()).countDocuments(scope(user, { state: "open" })),
    (await incidents()).countDocuments(scope(user, { state: { $ne: "resolved" } })),
    (await slos()).find(scope(user) as never).limit(5).toArray(),
    (await deploys()).find(scope(user) as never).sort({ at: -1 }).limit(5).toArray(),
    (await audit()).find({}).sort({ at: -1 }).limit(8).toArray(),
  ]);

  const svcNames = new Map(
    (await (await services()).find({ _id: { $in: sloRows.map((s) => s.serviceId) } }).toArray()).map((s) => [s._id.toHexString(), s.name]),
  );
  const limits = limitsFor(user.plan);
  const budgets = await Promise.all(sloRows.map((s) => errorBudget(s.serviceId, s.target, s.windowDays)));
  const bySev = (await (await incidents()).find(scope(user, { state: { $ne: "resolved" } }) as never).toArray()).reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {});
  const resolvedRows = await (await incidents()).find({ ...scope(user), state: "resolved", resolvedAt: { $ne: null } } as never).toArray();
  const mttr = resolvedRows.length
    ? Math.round((resolvedRows.reduce((s, r) => s + ((r.resolvedAt as Date).getTime() - r.openedAt.getTime()), 0) / resolvedRows.length / 60000) * 10) / 10
    : 0;

  return (
    <>
      <h1>Overview</h1>
      <p className="lead">
        {user.plan === "free" ? "Free plan â€” seeded demo data." : `Plan ${user.plan}.`}{" "}
        {limits.openIncidents !== -1 && `${ackd}/${limits.openIncidents} open incidents`}
      </p>

      <div className="grid cols4">
        <div className="panel stat">
          <div className="k">Services</div>
          <div className="v">{svcCount}</div>
          <div className="muted">{limits.services === -1 ? "unlimited" : `of ${limits.services}`}</div>
        </div>
        <div className="panel stat">
          <div className="k">Open</div>
          <div className="v">{open}</div>
          <div className="muted">sev-tagged</div>
        </div>
        <div className="panel stat">
          <div className="k">Unresolved</div>
          <div className="v">{ackd}</div>
          <div className="muted">any state</div>
        </div>
        <div className="panel stat">
          <div className="k">SLOs</div>
          <div className="v">{sloRows.length}</div>
          <div className="muted">tracked</div>
        </div>
      </div>

      <div className="grid cols4">
        <div className="panel stat">
          <div className="k">MTTR</div>
          <div className="v">{mttr}m</div>
        </div>
        <div className="panel stat">
          <div className="k">sev1 / sev2</div>
          <div className="v">
            {bySev.sev1 ?? 0} / {bySev.sev2 ?? 0}
          </div>
        </div>
        <div className="panel stat">
          <div className="k">Budget exhausted</div>
          <div className="v">{budgets.filter((b) => b.state === "exhausted").length}</div>
        </div>
        <div className="panel stat">
          <div className="k">Exports</div>
          <div className="v" style={{ fontSize: 15 }}>
            <Link href="/api/incidents?format=csv">incidents.csv</Link>
          </div>
        </div>
      </div>

      <h2>Open work</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Incident</th>
            <th>Opened</th>
          </tr>
        </thead>
        <tbody>
          {(await (await incidents()).find(scope(user, { state: { $ne: "resolved" } }) as never).sort({ openedAt: -1 }).limit(8).toArray()).map((i) => (
            <tr key={i._id.toHexString()}>
              <td>
                <span className={`pill ${i.severity}`}>{i.severity}</span>
              </td>
              <td>
                <Link href={`/incidents/${i._id.toHexString()}`}>{i.title}</Link>
              </td>
              <td className="muted">{i.openedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            </tr>
          ))}
          {open === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                Nothing open.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="grid cols2" style={{ marginTop: 24 }}>
        <div>
          <h2>SLOs</h2>
          <div className="panel">
            {sloRows.length === 0 && <p className="muted">No SLOs yet.</p>}
            {sloRows.map((s, i) => (
              <div key={s._id.toHexString()} style={{ marginBottom: 14 }}>
                <Link href={`/services/${s.serviceId.toHexString()}`}>{svcNames.get(s.serviceId.toHexString()) ?? "unknown"}</Link>{" "}
                <span className="muted">
                  {s.target}% / {s.windowDays}d
                </span>
                <BudgetBar budget={budgets[i]} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2>Recent deploys</h2>
          <div className="panel">
            {recent.length === 0 && <p className="muted">No deploys recorded.</p>}
            {recent.map((d) => (
              <p key={d._id.toHexString()} className="mono">
                {d.version} Â· {d.environment} Â· {d.status}
              </p>
            ))}
          </div>
        </div>
      </div>

      <h2>Activity</h2>
      <div className="panel mono">
        {activity.map((a) => (
          <div key={a._id.toHexString()} className="muted">
            {a.at.toISOString().slice(11, 19)} {a.actor} {a.action}
          </div>
        ))}
        {activity.length === 0 && <span className="muted">No activity.</span>}
      </div>
    </>
  );
}

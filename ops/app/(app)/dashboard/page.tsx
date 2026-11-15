import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { audit, deploys, incidents, services, slos } from "@/lib/collections";
import { limitsFor } from "@/lib/plans";
import { scope } from "@/lib/scope";

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
            {sloRows.map((s) => (
              <p key={s._id.toHexString()}>
                {svcNames.get(s.serviceId.toHexString()) ?? "unknown"} â€” {s.target}% / {s.windowDays}d ({s.indicator})
              </p>
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

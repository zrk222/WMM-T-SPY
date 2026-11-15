import Link from "next/link";
import { incidents, services } from "@/lib/collections";
import { currentUser } from "@/lib/auth";
import { NewIncident } from "./new-incident";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const user = (await currentUser())!;
  const filter = state === "all" ? {} : state ? { state } : { state: { $ne: "resolved" } };
  const rows = await (await incidents()).find(filter as never).sort({ openedAt: -1 }).limit(100).toArray();
  const names = new Map((await (await services()).find({}).toArray()).map((s) => [s._id.toHexString(), s.name]));

  return (
    <>
      <div className="row">
        <div>
          <h1>Incidents</h1>
          <p className="lead">open â†’ acknowledged â†’ monitoring â†’ resolved</p>
        </div>
        <span className="spacer" />
        {user.role !== "viewer" && <NewIncident />}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link className="pill" href="/incidents">
          open
        </Link>
        <Link className="pill" href="/incidents?state=acknowledged">
          acknowledged
        </Link>
        <Link className="pill" href="/incidents?state=monitoring">
          monitoring
        </Link>
        <Link className="pill" href="/incidents?state=resolved">
          resolved
        </Link>
        <Link className="pill" href="/incidents?state=all">
          all
        </Link>
      </div>
      <table>
        <thead>
          <tr>
            <th>Sev</th>
            <th>State</th>
            <th>Incident</th>
            <th>Service</th>
            <th>Opened</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
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
              <td className="muted">{names.get(i.serviceId.toHexString()) ?? "â€”"}</td>
              <td className="muted">{i.openedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

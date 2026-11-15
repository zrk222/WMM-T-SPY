import Link from "next/link";
import { deploys, services } from "@/lib/collections";
import { scope } from "@/lib/scope";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DeploysPage({ searchParams }: { searchParams: Promise<{ serviceId?: string }> }) {
  const { serviceId } = await searchParams;
  const user = (await currentUser())!;
  const filter: Record<string, unknown> = scope(user);
  if (serviceId) filter.serviceId = serviceId as never;
  const rows = await (await deploys()).find(filter as never).sort({ at: -1 }).limit(100).toArray();
  const names = new Map((await (await services()).find(scope(user) as never).toArray()).map((s) => [s._id.toHexString(), s.name]));

  return (
    <>
      <h1>Deploys</h1>
      <p className="lead">History is capped by plan; production and staging together.</p>
      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <select name="serviceId" defaultValue={serviceId ?? ""}>
          <option value="">All services</option>
          {[...names.entries()].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="ghost" type="submit">
          Filter
        </button>
      </form>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Service</th>
            <th>Version</th>
            <th>Env</th>
            <th>Status</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d._id.toHexString()}>
              <td className="muted mono">{d.at.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td>
                <Link href={`/services/${d.serviceId.toHexString()}`}>{names.get(d.serviceId.toHexString()) ?? "—"}</Link>
              </td>
              <td className="mono">{d.version}</td>
              <td>{d.environment}</td>
              <td>
                <span className={`pill ${d.status === "failed" || d.status === "rolled_back" ? "sev1" : d.status === "succeeded" ? "resolved" : "sev3"}`}>{d.status}</span>
              </td>
              <td className="muted">{d.deployedBy}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No deploys in window.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

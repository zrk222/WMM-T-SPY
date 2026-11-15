import { incidents, services } from "@/lib/collections";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status" };

export default async function StatusPage() {
  const [svc, open] = await Promise.all([
    (await services()).find({}).sort({ tier: 1, name: 1 }).toArray(),
    (await incidents()).find({ state: { $ne: "resolved" } }).toArray(),
  ]);
  const by = new Map<string, typeof open>();
  for (const i of open) {
    const k = i.serviceId.toHexString();
    by.set(k, [...(by.get(k) ?? []), i]);
  }
  const degraded = svc.filter((s) => by.has(s._id.toHexString())).length;

  return (
    <main>
      <h1>Status</h1>
      <p className="lead">
        {degraded === 0 ? "All systems operational." : `${degraded} of ${svc.length} services degraded.`} ·{" "}
        <span className="muted">refreshed {new Date().toISOString().slice(11, 19)} UTC</span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Tier</th>
            <th>State</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {svc.map((s) => {
            const inc = by.get(s._id.toHexString()) ?? [];
            return (
              <tr key={s._id.toHexString()}>
                <td>{s.name}</td>
                <td>{s.tier}</td>
                <td>
                  <span className={`pill ${inc.length ? "sev2" : "resolved"}`}>{inc.length ? "degraded" : "operational"}</span>
                </td>
                <td className="muted">{inc.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 16 }}>
        JSON: <code>/api/status</code>
      </p>
    </main>
  );
}

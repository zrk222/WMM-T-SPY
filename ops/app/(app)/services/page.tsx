import Link from "next/link";
import { services } from "@/lib/collections";
import { NewService } from "./new-service";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const filter = q ? { $text: { $search: q } } : {};
  const rows = await (await services()).find(filter as never).sort({ createdAt: -1 }).limit(100).toArray();

  return (
    <>
      <div className="row">
        <div>
          <h1>Services</h1>
          <p className="lead">Ownership, tier and SLO in one place.</p>
        </div>
        <span className="spacer" />
        <NewService />
      </div>

      <form method="get" className="row" style={{ marginBottom: 14 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search services" style={{ maxWidth: 320 }} />
        <button className="ghost" type="submit">
          Search
        </button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Tier</th>
            <th>Owner</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s._id.toHexString()}>
              <td>
                <Link href={`/services/${s._id.toHexString()}`}>{s.name}</Link>
              </td>
              <td>{s.tier}</td>
              <td className="muted">{s.owner || "—"}</td>
              <td className="muted">{s.tags.join(", ") || "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No services yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

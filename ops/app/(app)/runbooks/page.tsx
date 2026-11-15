import Link from "next/link";
import { runbooks } from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function RunbooksPage() {
  const rows = await (await runbooks()).find({}).sort({ name: 1 }).toArray();
  return (
    <>
      <h1>Runbooks</h1>
      <p className="lead">Ordered steps, executable by a human or an agent.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Steps</th>
            <th>Service</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id.toHexString()}>
              <td>
                <Link href={`/runbooks/${r._id.toHexString()}`}>{r.name}</Link>
              </td>
              <td>{r.steps.length}</td>
              <td className="muted">{r.serviceId?.toHexString() ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No runbooks. Seed with <code>npm run seed</code>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

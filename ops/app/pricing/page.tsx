import { PLAN_CATALOG } from "@/lib/plans";
import Link from "next/link";

export const metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <>
      <header className="top">
        <Link className="brand" href="/">
          CloudOps Console
        </Link>
        <span className="spacer" />
        <Link href="/status">Status</Link>
        <Link href="/login">Sign in</Link>
      </header>
      <main>
        <h1>Plans</h1>
        <p className="lead">Limits are enforced on the server, not in the UI.</p>
        <div className="grid cols2">
          {PLAN_CATALOG.map((p) => (
            <div className="panel" key={p.id}>
              <div className="row">
                <strong>{p.name}</strong>
                <span className="spacer" />
                <span className="mono">{p.monthlyUsd === 0 ? "free" : `$${p.monthlyUsd}/mo`}</span>
              </div>
              <ul className="muted">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/login">Choose {p.name}</Link>
            </div>
          ))}
        </div>
        <h2>Limits</h2>
        <table>
          <thead>
            <tr>
              <th>Limit</th>
              {PLAN_CATALOG.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["services", "services"],
                ["openIncidents", "open incidents"],
                ["runbooks", "runbooks"],
                ["apiKeys", "API keys"],
                ["deployHistoryDays", "deploy history (days)"],
              ] as const
            ).map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                {PLAN_CATALOG.map((p) => (
                  <td key={p.id}>{p.limits[key] === -1 ? "âˆž" : p.limits[key]}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>MCP write</td>
              {PLAN_CATALOG.map((p) => (
                <td key={p.id}>{p.limits.mcpWrite ? "yes" : "no"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </main>
    </>
  );
}

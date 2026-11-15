import Link from "next/link";
import { PLAN_CATALOG } from "@/lib/plans";

export default function Landing() {
  return (
    <>
      <header className="top">
        <span className="brand">CloudOps Console</span>
        <nav>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
        <span className="spacer" />
        <Link href="/login">Get started</Link>
      </header>
      <main>
        <h1>Run production without guesswork.</h1>
        <p className="lead">
          Services, incidents, deploys, runbooks and SLOs in one console — with an MCP surface so your
          agents can read the same state your humans do.
        </p>
        <div className="row">
          <Link href="/login">
            <button>Start free</button>
          </Link>
          <Link href="/pricing">
            <button className="ghost">See plans</button>
          </Link>
        </div>

        <h2>What you get</h2>
        <div className="grid cols2">
          <div className="panel">
            <strong>Incident workflow that matches reality</strong>
            <p className="muted">
              open → acknowledged → monitoring → resolved, with a full timeline, severity, impact and
              commander. Illegal transitions are rejected with 409.
            </p>
          </div>
          <div className="panel">
            <strong>Deploy history tied to services</strong>
            <p className="muted">Version, commit and environment on every deploy, windowed by plan.</p>
          </div>
          <div className="panel">
            <strong>Runbooks and SLOs</strong>
            <p className="muted">Ordered steps with commands, and per-service targets that travel with the service.</p>
          </div>
          <div className="panel">
            <strong>Agents, on a leash</strong>
            <p className="muted">
              Scoped API keys, max five, shown once. Read tools on every plan; write tools on Team and up.
            </p>
          </div>
        </div>

        <h2>Plans</h2>
        <div className="grid cols2">
          {PLAN_CATALOG.filter((p) => p.id !== "free").map((p) => (
            <div className="panel" key={p.id}>
              <strong>{p.name}</strong> — ${p.monthlyUsd}/mo
              <p className="muted">{p.features.join(" · ")}</p>
              <Link href="/login">Start</Link>
            </div>
          ))}
        </div>
      </main>
      <footer className="foot">CloudOps Console — demo build. Data is seeded, plans are enforced server-side.</footer>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

type Results = {
  services: { id: string; name: string; tier: number }[];
  incidents: { id: string; title: string; state: string; severity: string }[];
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setRes(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<Results>(`/api/search?q=${encodeURIComponent(q)}`);
      if (r.ok) setRes(r.data);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <h1>Search</h1>
      <p className="lead">Services and incidents in your workspace.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" autoFocus />
      {res && (
        <div style={{ marginTop: 16 }}>
          <h2>Services</h2>
          <div className="panel">
            {res.services.length === 0 && <span className="muted">No services.</span>}
            {res.services.map((s) => (
              <div key={s.id}>
                <Link href={`/services/${s.id}`}>{s.name}</Link> <span className="muted">tier {s.tier}</span>
              </div>
            ))}
          </div>
          <h2>Incidents</h2>
          <div className="panel">
            {res.incidents.length === 0 && <span className="muted">No incidents.</span>}
            {res.incidents.map((i) => (
              <div key={i.id}>
                <span className={`pill ${i.severity}`}>{i.severity}</span>{" "}
                <Link href={`/incidents/${i.id}`}>{i.title}</Link> <span className="muted">{i.state}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/client";

type Pm = { summary: string; rootCause: string; actions: string[]; author: string; at: string } | null;

export function Postmortem({ incidentId, state, pm }: { incidentId: string; state: string; pm: Pm }) {
  const [summary, setSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [actions, setActions] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (pm) {
    return (
      <div className="panel">
        <div className="row">
          <strong>Postmortem</strong>
          <span className="spacer" />
          <a href={`/api/incidents/${incidentId}/postmortem`}>
            <button className="ghost">Export .md</button>
          </a>
        </div>
        <p className="muted mono">
          {pm.author} · {new Date(pm.at).toISOString().slice(0, 16).replace("T", " ")}
        </p>
        <h3>Summary</h3>
        <p>{pm.summary}</p>
        <h3>Root cause</h3>
        <p>{pm.rootCause}</p>
        <h3>Actions</h3>
        <ul>
          {pm.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (state !== "resolved") return <p className="muted">Resolve the incident to write a postmortem.</p>;

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const res = await api<{ error?: string }>(`/api/incidents/${incidentId}/postmortem`, {
          method: "PUT",
          body: { summary, rootCause, actions: actions.split("\n").map((a) => a.trim()).filter(Boolean) },
        });
        if (!res.ok) return setMsg(res.data?.error ?? "Failed");
        location.reload();
      }}
    >
      <div className="field">
        <label>Summary</label>
        <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={10} />
      </div>
      <div className="field">
        <label>Root cause</label>
        <textarea rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} required minLength={10} />
      </div>
      <div className="field">
        <label>Actions (one per line)</label>
        <textarea rows={3} value={actions} onChange={(e) => setActions(e.target.value)} />
      </div>
      {msg && <p className="err">{msg}</p>}
      <button type="submit">Save postmortem</button>
    </form>
  );
}

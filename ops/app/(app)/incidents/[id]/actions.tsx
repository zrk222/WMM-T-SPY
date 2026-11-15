"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function IncidentActions({ id, allowed }: { id: string; allowed: string[] }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function transition(state: string) {
    setBusy(true);
    setError(null);
    const res = await api<{ error?: string }>(`/api/incidents/${id}`, {
      method: "PATCH",
      body: { state, ...(state === "resolved" && note ? { resolutionNote: note } : {}) },
    });
    setBusy(false);
    if (!res.ok) return setError(res.data?.error ?? "Failed");
    location.reload();
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    const res = await api<{ error?: string }>(`/api/incidents/${id}/notes`, { method: "POST", body: { note } });
    setBusy(false);
    if (!res.ok) return setError(res.data?.error ?? "Failed");
    setNote("");
    location.reload();
  }

  return (
    <div className="panel">
      <div className="field">
        <label>Note / resolution</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        {allowed.map((s) => (
          <button key={s} disabled={busy} onClick={() => transition(s)}>
            {s === "resolved" ? "Resolve" : s}
          </button>
        ))}
        <button className="ghost" disabled={busy} onClick={addNote}>
          Add note
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/client";

type Action = "acknowledge" | "monitor" | "resolve";

export function BulkBar({ selected }: { selected: string[] }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    setMsg(null);
    const res = await api<{ ok: number; failed: number; error?: string }>("/api/incidents/bulk", {
      method: "POST",
      body: { ids: selected, action, note: note || null },
    });
    setBusy(false);
    if (!res.ok) return setMsg(res.data?.error ?? "Failed");
    setMsg(`applied ${res.data!.ok}, failed ${res.data!.failed}`);
    setTimeout(() => location.reload(), 500);
  }

  return (
    <div className="panel" style={{ position: "sticky", top: 56, zIndex: 4 }}>
      <div className="row">
        <strong>{selected.length} selected</strong>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note for resolve (optional)" style={{ maxWidth: 320 }} />
        <button disabled={busy || selected.length === 0} onClick={() => run("acknowledge")}>
          Acknowledge
        </button>
        <button disabled={busy || selected.length === 0} onClick={() => run("monitor")}>
          Monitor
        </button>
        <button disabled={busy || selected.length === 0} onClick={() => run("resolve")}>
          Resolve
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  );
}

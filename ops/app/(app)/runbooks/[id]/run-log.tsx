"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Run = { id: string; status: string; note: string | null; at: string };

export function RunLog({ runbookId }: { runbookId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<"ok" | "failed" | "partial">("ok");
  const [note, setNote] = useState("");

  async function load() {
    const res = await api<{ items: Run[] }>(`/api/runbooks/${runbookId}/runs`);
    if (res.ok && res.data) setRuns(res.data.items);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runbookId]);

  return (
    <div className="panel">
      <div className="row">
        <select value={status} onChange={(e) => setStatus(e.target.value as "ok")} style={{ maxWidth: 150 }}>
          <option value="ok">ok</option>
          <option value="partial">partial</option>
          <option value="failed">failed</option>
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" />
        <button
          onClick={async () => {
            await api(`/api/runbooks/${runbookId}/runs`, { method: "POST", body: { status, note: note || null } });
            setNote("");
            load();
          }}
        >
          Log run
        </button>
      </div>
      <table style={{ marginTop: 10 }}>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>
                <span className={`pill ${r.status === "ok" ? "resolved" : r.status === "failed" ? "sev1" : "sev2"}`}>{r.status}</span>
              </td>
              <td className="muted">{r.note ?? ""}</td>
              <td className="muted mono">{new Date(r.at).toISOString().slice(0, 16).replace("T", " ")}</td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td className="muted">No runs logged.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

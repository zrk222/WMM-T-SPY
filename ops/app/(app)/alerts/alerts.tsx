"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Rule = { id: string; name: string; serviceId: string | null; severityMin: string; webhookUrl: string | null };
type Match = { rule: string; incidentId: string; title: string; severity: string; service: string };
type Delivery = { id: string; url: string; status: number | null; error: string | null; at: string };

export function Alerts() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [name, setName] = useState("");
  const [severityMin, setSeverityMin] = useState("sev2");
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  async function load() {
    const res = await api<{ items: Rule[]; matches: Match[]; deliveries: Delivery[] }>("/api/alerts");
    if (res.ok && res.data) {
      setRules(res.data.items);
      setMatches(res.data.matches);
      setDeliveries(res.data.deliveries);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <h2>Alert rules</h2>
      <p className="lead">Rules fire when an open incident is at or above the severity.</p>
      {matches.length > 0 && (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>{matches.length} firing</strong>
          {matches.map((m, i) => (
            <div key={i} className="muted">
              <span className={`pill ${m.severity}`}>{m.severity}</span> {m.title} Â· {m.service} Â· rule {m.rule}
            </div>
          ))}
        </div>
      )}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const res = await api<{ error?: string }>("/api/alerts", { method: "POST", body: { name, severityMin, webhookUrl: webhookUrl || null } });
          if (!res.ok) return setError(res.data?.error ?? "Failed");
          setName("");
          load();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="rule name" required style={{ maxWidth: 200 }} />
        <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="webhook URL (optional)" style={{ maxWidth: 300 }} />
        <select value={severityMin} onChange={(e) => setSeverityMin(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="sev1">sev1 only</option>
          <option value="sev2">sev2 and up</option>
          <option value="sev3">sev3 and up</option>
          <option value="sev4">all</option>
        </select>
        <button type="submit">Add rule</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table style={{ marginTop: 12 }}>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="muted">{r.severityMin} and up</td>
              <td>
                <button
                  className="ghost"
                  onClick={async () => {
                    await api(`/api/alerts/${r.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td className="muted">No rules.</td>
            </tr>
          )}
        </tbody>
      </table>
      <h2>Recent deliveries</h2>
      <table>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id}>
              <td className="mono muted">{new Date(d.at).toISOString().slice(11, 19)}</td>
              <td className="mono">{d.url}</td>
              <td>{d.status ?? "err"}</td>
              <td className="err">{d.error ?? ""}</td>
            </tr>
          ))}
          {deliveries.length === 0 && <tr><td className="muted">No deliveries yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function SloForm({ serviceId, sloId }: { serviceId: string; sloId?: string }) {
  const [target, setTarget] = useState("99.9");
  const [windowDays, setWindowDays] = useState<"7" | "30" | "90">("30");
  const [indicator, setIndicator] = useState<"availability" | "latency">("availability");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await api<{ error?: string }>("/api/slos", {
          method: "POST",
          body: { serviceId, target: Number(target), windowDays: Number(windowDays), indicator },
        });
        setMsg(res.ok ? "Saved." : (res.data?.error ?? "Failed"));
      }}
    >
      <div className="field">
        <label>Target %</label>
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
      </div>
      <div className="field">
        <label>Window</label>
        <select value={windowDays} onChange={(e) => setWindowDays(e.target.value as "30")}>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </div>
      <div className="field">
        <label>Indicator</label>
        <select value={indicator} onChange={(e) => setIndicator(e.target.value as "availability")}>
          <option value="availability">availability</option>
          <option value="latency">latency</option>
        </select>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="row">
        <button type="submit">Save SLO</button>
        {sloId && (
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              await api(`/api/slos/${sloId}`, { method: "DELETE" });
              location.reload();
            }}
          >
            Delete SLO
          </button>
        )}
      </div>
    </form>
  );
}

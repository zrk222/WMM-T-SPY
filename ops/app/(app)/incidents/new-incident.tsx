"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Svc = { id: string; name: string };

export function NewIncident({ serviceId }: { serviceId?: string }) {
  const [open, setOpen] = useState(Boolean(serviceId));
  const [services, setServices] = useState<Svc[]>([]);
  const [svc, setSvc] = useState(serviceId ?? "");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("sev3");
  const [impact, setImpact] = useState("minor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || serviceId) return;
    api<{ items: Svc[] }>("/api/services?pageSize=50").then((r) => {
      if (r.ok && r.data) {
        setServices(r.data.items);
        if (!svc && r.data.items[0]) setSvc(r.data.items[0].id);
      }
    });
  }, [open, serviceId, svc]);

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        New incident
      </button>
    );
  }

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api<{ id: string; error?: string }>("/api/incidents", {
          method: "POST",
          body: { serviceId: svc, title, severity, impact },
        });
        setBusy(false);
        if (!res.ok) return setError(res.data?.error ?? "Failed");
        location.href = `/incidents/${res.data!.id}`;
      }}
    >
      {!serviceId && (
        <div className="field">
          <label>Service</label>
          <select value={svc} onChange={(e) => setSvc(e.target.value)} required>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} />
      </div>
      <div className="field">
        <label>Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="sev1">sev1</option>
          <option value="sev2">sev2</option>
          <option value="sev3">sev3</option>
          <option value="sev4">sev4</option>
        </select>
      </div>
      <div className="field">
        <label>Impact</label>
        <select value={impact} onChange={(e) => setImpact(e.target.value)}>
          <option value="critical">critical</option>
          <option value="major">major</option>
          <option value="minor">minor</option>
          <option value="none">none</option>
        </select>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy || !svc}>
          {busy ? "Opening…" : "Open incident"}
        </button>
        {!serviceId && (
          <button type="button" className="ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

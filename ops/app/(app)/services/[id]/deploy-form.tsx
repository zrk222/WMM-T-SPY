"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function DeployForm({ serviceId }: { serviceId: string }) {
  const [version, setVersion] = useState("");
  const [commit, setCommit] = useState("");
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await api<{ error?: string }>("/api/deploys", {
          method: "POST",
          body: { serviceId, version, commit, environment, status: "succeeded" },
        });
        setMsg(res.ok ? "Recorded." : (res.data?.error ?? "Failed"));
        if (res.ok) {
          setVersion("");
          setCommit("");
          location.reload();
        }
      }}
    >
      <div className="field">
        <label>Version</label>
        <input value={version} onChange={(e) => setVersion(e.target.value)} required />
      </div>
      <div className="field">
        <label>Commit</label>
        <input value={commit} onChange={(e) => setCommit(e.target.value)} />
      </div>
      <div className="field">
        <label>Environment</label>
        <select value={environment} onChange={(e) => setEnvironment(e.target.value as "staging")}>
          <option value="staging">staging</option>
          <option value="production">production</option>
        </select>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <button type="submit">Record deploy</button>
    </form>
  );
}

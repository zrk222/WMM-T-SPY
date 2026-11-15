"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Key = { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null };

export function Keys() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [max, setMax] = useState(1);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{ items: Key[]; max: number }>("/api/keys");
    if (res.ok && res.data) {
      setKeys(res.data.items);
      setMax(res.data.max);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <h2>API keys</h2>
      <p className="lead">Bearer `ck_…` for the MCP endpoint. Shown once. Max {max}.</p>
      {secret && (
        <div className="panel">
          <p className="err">Copy now — it will not be shown again:</p>
          <pre>{secret}</pre>
        </div>
      )}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSecret(null);
          const res = await api<{ key?: string; error?: string }>("/api/keys", {
            method: "POST",
            body: { name, scopes: ["ops:read", "ops:write"] },
          });
          if (!res.ok) return setError(res.data?.error ?? "Failed");
          setSecret(res.data?.key ?? null);
          setName("");
          load();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="key name" required style={{ maxWidth: 260 }} />
        <button type="submit">Create key</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Prefix</th>
            <th>Scopes</th>
            <th>Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.name}</td>
              <td className="mono">{k.prefix}…</td>
              <td className="muted">{k.scopes.join(", ")}</td>
              <td className="muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toISOString().slice(0, 16) : "never"}</td>
              <td>
                <button
                  className="ghost"
                  onClick={async () => {
                    await api(`/api/keys/${k.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
          {keys.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No keys.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

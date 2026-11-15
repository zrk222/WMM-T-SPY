"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export function NewService() {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [tier, setTier] = useState<"1" | "2" | "3">("2");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        New service
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
        const res = await api<{ id: string; error?: string }>("/api/services", {
          method: "POST",
          body: { name, owner, tier: Number(tier), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) },
        });
        setBusy(false);
        if (!res.ok) return setError(res.data?.error ?? "Failed");
        location.reload();
      }}
    >
      <div className="field">
        <label htmlFor="s-name">Name</label>
        <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="s-owner">Owner</label>
        <input id="s-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="s-tier">Tier</label>
        <select id="s-tier" value={tier} onChange={(e) => setTier(e.target.value as "1")}>
          <option value="1">1 — critical</option>
          <option value="2">2 — standard</option>
          <option value="3">3 — internal</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="s-tags">Tags (comma separated)</label>
        <input id="s-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create"}
        </button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

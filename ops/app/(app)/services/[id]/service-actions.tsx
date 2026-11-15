"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function ServiceActions({
  service,
}: {
  service: { id: string; name: string; owner: string; description: string; tier: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(service.name);
  const [owner, setOwner] = useState(service.owner);
  const [description, setDescription] = useState(service.description);
  const [tier, setTier] = useState(String(service.tier));
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="row">
        <button className="ghost" onClick={() => setOpen(true)}>
          Edit
        </button>
        <button
          className="ghost"
          onClick={async () => {
            if (!confirm(`Delete ${service.name}?`)) return;
            const res = await api<{ error?: string }>(`/api/services/${service.id}`, { method: "DELETE" });
            if (!res.ok) return setError(res.data?.error ?? "Failed");
            router.push("/services");
          }}
        >
          Delete
        </button>
        {error && <span className="err">{error}</span>}
      </div>
    );
  }

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await api<{ error?: string }>(`/api/services/${service.id}`, {
          method: "PATCH",
          body: { name, owner, description, tier: Number(tier) },
        });
        if (!res.ok) return setError(res.data?.error ?? "Failed");
        setOpen(false);
        router.refresh();
      }}
    >
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Owner</label>
        <input value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <div className="field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="field">
        <label>Tier</label>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button type="submit">Save</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

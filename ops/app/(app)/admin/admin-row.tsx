"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

type Row = { id: string; email: string; role: string; plan: string; banned: boolean };

export function AdminRow({ user }: { user: Row }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await api<{ error?: string }>(`/api/admin/users?id=${user.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) return setError(res.data?.error ?? "Failed");
    router.refresh();
  }

  return (
    <tr>
      <td>
        {user.email}
        {user.banned && <span className="pill sev1" style={{ marginLeft: 8 }}>suspended</span>}
      </td>
      <td>
        <select value={user.role} disabled={busy} onChange={(e) => patch({ role: e.target.value })}>
          <option value="admin">admin</option>
          <option value="operator">operator</option>
          <option value="viewer">viewer</option>
        </select>
      </td>
      <td>
        <select value={user.plan} disabled={busy} onChange={(e) => patch({ plan: e.target.value })}>
          <option value="free">free</option>
          <option value="team">team</option>
          <option value="scale">scale</option>
        </select>
      </td>
      <td>
        <button className="ghost" disabled={busy} onClick={() => patch({ banned: !user.banned })}>
          {user.banned ? "Restore" : "Suspend"}
        </button>
        {error && <div className="err">{error}</div>}
      </td>
    </tr>
  );
}

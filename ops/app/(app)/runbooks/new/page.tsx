"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function NewRunbook() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState([{ title: "", command: "" }]);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await api<{ id?: string; error?: string }>("/api/runbooks", {
          method: "POST",
          body: { name, steps: steps.filter((s) => s.title.trim()).map((s) => ({ title: s.title, command: s.command || null })) },
        });
        if (!res.ok) return setError(res.data?.error ?? "Failed");
        router.push(`/runbooks/${res.data!.id}`);
      }}
    >
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      {steps.map((s, i) => (
        <div key={i} className="field">
          <label>Step {i + 1}</label>
          <input value={s.title} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Action" />
          <input value={s.command} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, command: e.target.value } : x)))} placeholder="command (optional)" className="mono" />
        </div>
      ))}
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button type="button" className="ghost" onClick={() => setSteps([...steps, { title: "", command: "" }])}>
          Add step
        </button>
        <button type="submit">Create runbook</button>
      </div>
    </form>
  );
}

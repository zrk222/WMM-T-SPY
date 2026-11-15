"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { name, email, password };
    const res = await api<{ user?: unknown; error?: string; attemptsRemaining?: number }>(path, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      const extra = res.data?.attemptsRemaining !== undefined ? ` (${res.data.attemptsRemaining} attempts left)` : "";
      setError((res.data?.error ?? "Request failed") + extra);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
      <p className="lead">{mode === "login" ? "Use your console credentials." : "The first account becomes admin."}</p>
      <form className="panel" onSubmit={submit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 10 : 1}
          />
          {mode === "signup" && <span className="muted">At least 10 characters.</span>}
        </div>
        {error && <p className="err">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Need an account?" : "Have an account?"}
          </button>
        </div>
      </form>
    </main>
  );
}

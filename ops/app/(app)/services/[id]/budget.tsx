import type { Budget } from "@/lib/slo";

const COLORS: Record<Budget["state"], string> = {
  ok: "var(--ok)",
  warning: "var(--warn)",
  exhausted: "var(--bad)",
};

export function BudgetBar({ budget }: { budget: Budget }) {
  const used = Math.min(100, 100 - budget.remainingPct);
  return (
    <div className="panel">
      <div className="row">
        <strong>{budget.remainingPct}% budget left</strong>
        <span className="spacer" />
        <span className={`pill ${budget.state}`}>{budget.state}</span>
      </div>
      <div style={{ height: 8, background: "#0a1017", borderRadius: 999, margin: "10px 0" }}>
        <div style={{ width: `${used}%`, height: "100%", background: COLORS[budget.state], borderRadius: 999 }} />
      </div>
      <p className="muted mono">
        {budget.consumedMinutes} / {budget.budgetMinutes} min consumed over {budget.windowDays}d · burn 24h {budget.burn24h}×
      </p>
    </div>
  );
}

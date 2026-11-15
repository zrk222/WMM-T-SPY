import { ObjectId } from "mongodb";
import { incidents } from "./collections";

const MIN = 60_000;

export type Budget = {
  windowDays: number;
  budgetMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  remainingPct: number;
  burn24h: number;
  state: "ok" | "warning" | "exhausted";
};

/** Availability budget from incident downtime (upper bound: any open overlap counts). */
export async function errorBudget(serviceId: ObjectId, target: number, windowDays: number): Promise<Budget> {
  const now = Date.now();
  const windowMs = windowDays * 86_400_000;
  const start = now - windowMs;
  const budgetMinutes = ((100 - target) / 100) * windowDays * 1440;

  const rows = await (await incidents())
    .find({ serviceId, openedAt: { $gte: new Date(start) } })
    .project({ openedAt: 1, resolvedAt: 1 })
    .toArray();

  let consumed = 0;
  let consumed24 = 0;
  const dayAgo = now - 86_400_000;
  for (const r of rows) {
    const from = Math.max(r.openedAt.getTime(), start);
    const to = Math.min(r.resolvedAt?.getTime() ?? now, now);
    if (to > from) consumed += (to - from) / MIN;
    const from24 = Math.max(r.openedAt.getTime(), dayAgo);
    if (to > from24) consumed24 += (to - from24) / MIN;
  }

  const remaining = budgetMinutes - consumed;
  return {
    windowDays,
    budgetMinutes: round(budgetMinutes),
    consumedMinutes: round(consumed),
    remainingMinutes: round(remaining),
    remainingPct: budgetMinutes > 0 ? round(Math.max((remaining / budgetMinutes) * 100, 0)) : 0,
    burn24h: round(consumed24 / 24),
    state: remaining <= 0 ? "exhausted" : remaining < budgetMinutes * 0.25 ? "warning" : "ok",
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

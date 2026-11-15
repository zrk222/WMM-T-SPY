import type { Plan } from "./collections";
export type { Plan };

export type Limits = {
  services: number;
  openIncidents: number;
  runbooks: number;
  slos: number;
  apiKeys: number;
  deployHistoryDays: number;
  mcpWrite: boolean;
};

export const PLANS: Record<Plan, { name: string; monthlyUsd: number; limits: Limits; features: string[] }> = {
  free: {
    name: "Free",
    monthlyUsd: 0,
    limits: { services: 3, openIncidents: 25, runbooks: 2, slos: 3, apiKeys: 1, deployHistoryDays: 7, mcpWrite: false },
    features: ["3 services", "25 open incidents", "1 API key", "read-only MCP"],
  },
  team: {
    name: "Team",
    monthlyUsd: 49,
    limits: { services: 50, openIncidents: 500, runbooks: 50, slos: 50, apiKeys: 5, deployHistoryDays: 90, mcpWrite: true },
    features: ["50 services", "500 open incidents", "5 API keys", "read/write MCP", "90-day deploy history"],
  },
  scale: {
    name: "Scale",
    monthlyUsd: 399,
    limits: { services: -1, openIncidents: -1, runbooks: -1, slos: -1, apiKeys: 20, deployHistoryDays: 730, mcpWrite: true },
    features: ["unlimited services", "unlimited incidents", "20 API keys", "read/write MCP", "2-year history", "priority support"],
  },
};

export const PLAN_ORDER: Plan[] = ["free", "team", "scale"];

export function limitsFor(plan: Plan): Limits {
  return PLANS[plan]?.limits ?? PLANS.free.limits;
}

export function within(limit: number, current: number) {
  return limit === -1 || current < limit;
}

export const PLAN_CATALOG = PLAN_ORDER.map((id) => ({
  id,
  name: PLANS[id].name,
  monthlyUsd: PLANS[id].monthlyUsd,
  features: PLANS[id].features,
  limits: PLANS[id].limits,
}));

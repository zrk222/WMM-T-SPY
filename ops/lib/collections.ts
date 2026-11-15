import type { Collection, Db, ObjectId } from "mongodb";
import { getDb } from "./db";

export type Role = "admin" | "operator" | "viewer";
export type Plan = "free" | "team" | "scale";
export type Severity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentState = "open" | "acknowledged" | "monitoring" | "resolved";
export type Impact = "critical" | "major" | "minor" | "none";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  plan: Plan;
  tv: number;
  lockedUntil: Date | null;
  failedLogins: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  description: string;
  owner: string;
  tier: 1 | 2 | 3;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  serviceId: ObjectId;
  title: string;
  severity: Severity;
  state: IncidentState;
  impact: Impact;
  commander: string | null;
  openedBy: string;
  openedAt: Date;
  ackAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentEventDoc {
  _id: ObjectId;
  incidentId: ObjectId;
  kind: "opened" | "acknowledged" | "monitoring" | "resolved" | "note";
  actor: string;
  note: string | null;
  at: Date;
}

export interface DeployDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  serviceId: ObjectId;
  version: string;
  commit: string;
  environment: "staging" | "production";
  status: "started" | "succeeded" | "failed" | "rolled_back";
  deployedBy: string;
  at: Date;
}

export interface RunbookDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  serviceId: ObjectId | null;
  steps: { title: string; command: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SloDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  serviceId: ObjectId;
  target: number;
  windowDays: number;
  indicator: "availability" | "latency";
  updatedAt: Date;
}

export interface ApiKeyDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: ("ops:read" | "ops:write")[];
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AuditDoc {
  _id: ObjectId;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  at: Date;
}

export async function col<T extends { _id: ObjectId }>(name: string): Promise<Collection<T>> {
  const db: Db = await getDb();
  return db.collection<T>(name);
}

export const users = () => col<UserDoc>("users");
export const services = () => col<ServiceDoc>("services");
export const incidents = () => col<IncidentDoc>("incidents");
export const incidentEvents = () => col<IncidentEventDoc>("incident_events");
export const deploys = () => col<DeployDoc>("deploys");
export const runbooks = () => col<RunbookDoc>("runbooks");
export const slos = () => col<SloDoc>("slos");
export const apiKeys = () => col<ApiKeyDoc>("api_keys");
export const audit = () => col<AuditDoc>("audit");

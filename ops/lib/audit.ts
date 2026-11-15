import { getDb } from "./db";

export async function recordAudit(input: {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const db = await getDb();
  await db.collection("audit").insertOne({
    actor: input.actor,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    at: new Date(),
  });
}

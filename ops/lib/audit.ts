import { ObjectId } from "mongodb";
import { getDb } from "./db";

export async function recordAudit(input: {
  actor: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const db = await getDb();
  await db.collection("audit").insertOne({
    actor: input.actor,
    actorId: input.actorId ?? (/^[a-f0-9]{24}$/.test(input.actor) ? new ObjectId(input.actor) : null),
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    at: new Date(),
  });
}

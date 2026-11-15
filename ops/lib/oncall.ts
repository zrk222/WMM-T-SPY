import { ObjectId } from "mongodb";
import { users } from "./collections";

export const WEEK_MS = 7 * 86_400_000;

/** Deterministic weekly rotation: roster[weekIndex % roster.length]. */
export function currentIndex(rosterLength: number, at = Date.now()) {
  if (rosterLength === 0) return -1;
  return Math.floor(at / WEEK_MS) % rosterLength;
}

export async function oncallRoster(ids: ObjectId[]) {
  if (ids.length === 0) return [];
  const rows = await (await users()).find({ _id: { $in: ids } }).toArray();
  const byId = new Map(rows.map((u) => [u._id.toHexString(), u]));
  return ids
    .map((id) => byId.get(id.toHexString()))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ id: u._id.toHexString(), name: u.name, email: u.email }));
}

export async function currentOncallIds(ids: ObjectId[]) {
  const idx = currentIndex(ids.length);
  if (idx < 0) return [];
  return [ids[idx]];
}

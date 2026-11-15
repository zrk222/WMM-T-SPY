import type { Filter } from "mongodb";

type CursorShape = { c: string; i: string };

export function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString("base64url");
}

export function decodeCursor(raw: string | null): CursorShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString()) as CursorShape;
    if (typeof parsed.c !== "string" || typeof parsed.i !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Append a keyset predicate for sort { createdAt: -1, _id: -1 }. */
export function applyCursor<T extends Record<string, unknown>>(filter: Filter<T>, cursor: CursorShape | null) {
  if (!cursor) return filter;
  const at = new Date(cursor.c);
  return {
    ...filter,
    $or: [
      { createdAt: { $lt: at } },
      { createdAt: at, _id: { $lt: cursor.i as unknown as never } },
    ],
  } as Filter<T>;
}

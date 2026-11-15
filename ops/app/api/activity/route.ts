import { ObjectId } from "mongodb";
import { audit, incidents, services } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { json, pageParams } from "@/lib/http";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { scope } from "@/lib/scope";

export const dynamic = "force-dynamic";

type Item = { kind: string; at: Date; summary: string; id: string };

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;

  const url = new URL(req.url);
  const { cursor, pageSize } = pageParams(url, 100);
  const cur = decodeCursor(cursor);
  const filter: Record<string, unknown> = scope(g.ctx.user);
  if (cur) filter.at = { $lt: new Date(cur.c) };

  const [inc, aud, svc] = await Promise.all([
    (await incidents()).find(filter as never).sort({ at: -1, _id: -1 }).limit(pageSize).toArray(),
    (await audit()).find(filter as never).sort({ at: -1, _id: -1 }).limit(pageSize).toArray(),
    (await services()).find(filter as never).sort({ createdAt: -1, _id: -1 }).limit(pageSize).toArray(),
  ]);

  const names = new Map(svc.map((s) => [s._id.toHexString(), s.name]));
  const items: Item[] = [
    ...inc.map((i) => ({ kind: "incident", at: i.openedAt, id: i._id.toHexString(), summary: `${i.severity.toUpperCase()} ${i.state}: ${i.title}` })),
    ...aud.map((a) => ({ kind: "audit", at: (a as { at: Date }).at, id: (a as { _id: ObjectId })._id.toHexString(), summary: `${(a as { actor: string }).actor} ${(a as { action: string }).action}` })),
    ...svc.map((s) => ({ kind: "service", at: s.createdAt, id: s._id.toHexString(), summary: `service ${names.get(s._id.toHexString())}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const page = items.slice(0, pageSize);
  return json({
    items: page,
    nextCursor: page.length === pageSize ? encodeCursor(page[page.length - 1].at, page[page.length - 1].id) : null,
  });
}

import { z } from "zod";
import { ObjectId } from "mongodb";
import { services } from "@/lib/collections";
import { applyCursor, decodeCursor, encodeCursor } from "@/lib/cursor";
import { gate, quota } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { json, pageParams, parseBody } from "@/lib/http";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  owner: z.string().trim().max(120).default(""),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  dependencies: z.array(z.string()).max(20).default([]),
  oncall: z.array(z.string()).max(20).default([]),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;

  const url = new URL(req.url);
  const { cursor, pageSize } = pageParams(url);
  const q = url.searchParams.get("q")?.trim();
  const tag = url.searchParams.get("tag")?.trim();
  const tier = url.searchParams.get("tier");

  const base: Record<string, unknown> = {};
  if (q) base.$text = { $search: q };
  if (tag) base.tags = tag;
  if (tier) base.tier = Number(tier);

  const filter = applyCursor(scope(g.ctx.user, base), decodeCursor(cursor));
  const rows = await (await services())
    .find(filter as never)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .toArray();

  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  return json({
    items: page.map((s) => ({
      id: s._id.toHexString(),
      name: s.name,
      description: s.description,
      owner: s.owner,
      tier: s.tier,
      tags: s.tags,
      createdAt: s.createdAt,
    })),
    nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1]._id.toHexString()) : null,
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;

  const count = await (await services()).countDocuments(scope(g.ctx.user));
  const over = await quota(g.ctx.user, "services", count);
  if (over) return over;

  const parsed = await parseBody(req, createSchema);
  if (!parsed.ok) return parsed.response;

  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    ownerId: g.ctx.user._id,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    owner: parsed.data.owner ?? "",
    tier: parsed.data.tier ?? 2,
    tags: parsed.data.tags ?? [],
    dependencies: (parsed.data.dependencies ?? []).filter((d) => ObjectId.isValid(d)).map((d) => new ObjectId(d)),
    oncall: (parsed.data.oncall ?? []).filter((d) => ObjectId.isValid(d)).map((d) => new ObjectId(d)),
    createdAt: now,
    updatedAt: now,
  };
  await (await services()).insertOne(doc);
  await recordAudit({ actor: g.ctx.user._id.toHexString(), action: "service.create", entity: "service", entityId: doc._id.toHexString(), after: doc });
  return json({ id: doc._id.toHexString() }, 201);
}

import { z } from "zod";
import { ObjectId } from "mongodb";
import { services, slos } from "@/lib/collections";
import { gate, quota } from "@/lib/guard";
import { scope } from "@/lib/scope";
import { fail, json, parseBody } from "@/lib/http";

const schema = z.object({
  serviceId: z.string().min(1),
  target: z.number().min(90).max(99.999),
  windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  indicator: z.enum(["availability", "latency"]).default("availability"),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const rows = await (await slos()).find(scope(g.ctx.user) as never).toArray();
  const svc = await (await services()).find({ _id: { $in: rows.map((r) => r.serviceId) } }).toArray();
  const names = new Map(svc.map((s) => [s._id.toHexString(), s.name]));
  return json({
    items: rows.map((s) => ({
      id: s._id.toHexString(),
      serviceId: s.serviceId.toHexString(),
      serviceName: names.get(s.serviceId.toHexString()) ?? "unknown",
      target: s.target,
      windowDays: s.windowDays,
      indicator: s.indicator,
    })),
  });
}

export async function POST(req: Request) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  if (!ObjectId.isValid(parsed.data.serviceId)) return fail("Unknown serviceId", 400);
  const svc = await (await services()).findOne({ _id: new ObjectId(parsed.data.serviceId), ...scope(g.ctx.user) } as never);
  if (!svc) return fail("Unknown serviceId", 400);

  const existing = await (await slos()).findOne({ serviceId: svc._id } as never);
  if (existing) {
    await (await slos()).updateOne(
      { _id: existing._id },
      { $set: { target: parsed.data.target, windowDays: parsed.data.windowDays, indicator: parsed.data.indicator, updatedAt: new Date() } },
    );
    return json({ id: existing._id.toHexString(), updated: true });
  }

  const count = await (await slos()).countDocuments(scope(g.ctx.user));
  const over = await quota(g.ctx.user, "slos", count);
  if (over) return over;

  const doc = { _id: new ObjectId(), ownerId: g.ctx.user._id, serviceId: svc._id, target: parsed.data.target, windowDays: parsed.data.windowDays ?? 30, indicator: parsed.data.indicator ?? "availability", updatedAt: new Date() };
  await (await slos()).insertOne(doc);
  return json({ id: doc._id.toHexString() }, 201);
}

import { z } from "zod";
import { ObjectId } from "mongodb";
import { incidents } from "@/lib/collections";
import { gate } from "@/lib/guard";
import { fail, json, parseBody } from "@/lib/http";
import { scope } from "@/lib/scope";

const schema = z.object({
  summary: z.string().trim().min(10).max(4000),
  rootCause: z.string().trim().min(10).max(4000),
  actions: z.array(z.string().trim().min(3).max(400)).max(30).default([]),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator", "viewer"]);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Incident not found", 404);
  const inc = await (await incidents()).findOne({ _id: new ObjectId(id), ...scope(g.ctx.user) } as never);
  if (!inc) return fail("Incident not found", 404);
  if (!inc.postmortem) return fail("No postmortem", 404);
  const pm = inc.postmortem;
  const md = [`# Postmortem: ${inc.title}`, "", `- Author: ${pm.author}`, `- At: ${pm.at.toISOString()}`, `- Severity: ${inc.severity}`, "", "## Summary", "", pm.summary, "", "## Root cause", "", pm.rootCause, "", "## Actions", "", ...pm.actions.map((a) => `- [ ] ${a}`), ""].join("\n");
  return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="postmortem-${id}.md"` } });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ["admin", "operator"], { writeScope: true });
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return fail("Incident not found", 404);
  const oid = new ObjectId(id);
  const inc = await (await incidents()).findOne({ _id: oid, ...scope(g.ctx.user) } as never);
  if (!inc) return fail("Incident not found", 404);
  if (inc.state !== "resolved") return fail("Resolve the incident before writing a postmortem", 409);

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  await (await incidents()).updateOne(
    { _id: oid },
    { $set: { postmortem: { ...parsed.data, author: g.ctx.user.email, at: new Date() }, updatedAt: new Date() } },
  );
  return json({ success: true });
}

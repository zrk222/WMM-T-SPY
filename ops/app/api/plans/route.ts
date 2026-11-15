import { PLAN_CATALOG } from "@/lib/plans";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ plans: PLAN_CATALOG });
}

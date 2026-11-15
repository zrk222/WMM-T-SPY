import { currentUser, publicUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { limitsFor } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ user: null, authenticated: false }, 401);
  return json({ user: publicUser(user), limits: limitsFor(user.plan) });
}

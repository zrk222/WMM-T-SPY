export const dynamic = "force-dynamic";

export async function GET() {
  const pkg = (await import("@/package.json", { with: { type: "json" } })).default;
  return Response.json({
    name: pkg.name,
    version: pkg.version,
    commit: process.env.GIT_SHA ?? "dev",
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
  });
}

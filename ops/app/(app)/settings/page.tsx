import { currentUser } from "@/lib/auth";
import { Keys } from "./keys";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const user = (await currentUser())!;
  return (
    <>
      <h1>Settings</h1>
      <p className="lead">
        {user.email} · role {user.role} · plan {user.plan}
      </p>
      <Keys />
      <h2>MCP</h2>
      <div className="panel">
        <p className="muted">Endpoint</p>
        <pre>POST /api/mcp</pre>
        <p className="muted">Header</p>
        <pre>Authorization: Bearer ck_…</pre>
        <p className="muted">
          Discovery: <code>/.well-known/oauth-protected-resource</code>
        </p>
        <pre>{`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`}</pre>
      </div>
    </>
  );
}

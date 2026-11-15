export function GET() {
  return Response.json({
    resource: "https://app.local/api/mcp",
    authorization_servers: ["https://app.local"],
    bearer_methods_supported: ["header"],
    scopes_supported: ["ops:read", "ops:write"],
    resource_name: "CloudOps Console MCP",
  });
}

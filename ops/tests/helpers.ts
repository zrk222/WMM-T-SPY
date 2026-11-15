export const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";

export type Reply<T = any> = { status: number; data: T; headers: Headers; cookies: Record<string, string> };

export class Client {
  cookies: Record<string, string> = {};

  async req<T = any>(path: string, init: { method?: string; body?: unknown; csrf?: boolean } = {}): Promise<Reply<T>> {
    const method = init.method ?? "GET";
    const headers: Record<string, string> = {};
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.cookie = cookie;
    if (init.csrf !== false && method !== "GET" && this.cookies.csrf) headers["x-csrf"] = this.cookies.csrf;

    const res = await fetch(`${BASE}${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (value === "") delete this.cookies[name];
      else this.cookies[name] = value;
    }
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers, cookies: { ...this.cookies } };
  }

  get<T = any>(p: string) {
    return this.req<T>(p);
  }
  post<T = any>(p: string, body?: unknown, csrf = true) {
    return this.req<T>(p, { method: "POST", body, csrf });
  }
  patch<T = any>(p: string, body?: unknown) {
    return this.req<T>(p, { method: "PATCH", body });
  }
  del<T = any>(p: string) {
    return this.req<T>(p, { method: "DELETE" });
  }

  async signup(email = `u${Date.now()}${Math.random().toString(16).slice(2, 6)}@test.dev`, plan?: "free" | "team" | "scale", role?: "admin" | "operator" | "viewer") {
    const res = await this.post("/api/auth/signup", { name: "Test User", email, password: "Passw0rd!123" });
    if (res.status !== 201) throw new Error(`signup failed ${res.status} ${JSON.stringify(res.data)}`);
    if (plan || role) {
      const admin = await bootstrapAdmin();
      const patched = await admin.patch(`/api/admin/users?id=${res.data.user.id}`, { ...(plan ? { plan } : {}), ...(role ? { role } : {}) });
      if (patched.status !== 200) throw new Error(`plan patch failed ${patched.status} ${JSON.stringify(patched.data)}`);
      await this.req("/api/auth/me");
    }
    return res.data.user as { id: string; email: string };
  }

  async login(email: string, password = "Passw0rd!123") {
    return this.post("/api/auth/login", { email, password });
  }
}

/** First signup on a fresh database becomes admin on the scale plan. */
export async function bootstrapAdmin() {
  const c = new Client();
  const res = await c.post("/api/auth/signup", {
    name: "Admin",
    email: "admin@test.dev",
    password: "Passw0rd!123",
  });
  if (res.status !== 201) {
    const again = await c.login("admin@test.dev");
    if (again.status !== 200) throw new Error("bootstrap admin failed");
  }
  return c;
}

export function keyClient(secret: string) {
  return {
    async call(body: unknown) {
      const res = await fetch(`${BASE}/api/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
  };
}

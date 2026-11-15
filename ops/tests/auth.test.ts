import { describe, expect, it } from "vitest";
import { Client } from "./helpers";

describe("auth contract", () => {
  it("signup sets an httpOnly session cookie plus a readable csrf cookie", async () => {
    const c = new Client();
    const res = await c.post("/api/auth/signup", { name: "Ada Tester", email: `s${Date.now()}@test.dev`, password: "Passw0rd!123" });
    expect(res.status).toBe(201);
    const setCookies = res.headers.getSetCookie().join(" | ").toLowerCase();
    expect(setCookies).toContain("token=");
    expect(setCookies).toContain("httponly");
    expect(setCookies).toContain("samesite=lax");
    expect(c.cookies.csrf).toBeTruthy();
  });

  it("me is 401 when anonymous and 200 when signed in", async () => {
    const anon = new Client();
    expect((await anon.get("/api/auth/me")).status).toBe(401);

    const c = new Client();
    await c.signup();
    const me = await c.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.data.user.email).toContain("@test.dev");
  });

  it("rejects mutations without the csrf header", async () => {
    const c = new Client();
    await c.signup();
    const svc = await c.post("/api/services", { name: "csrf-check" }, false);
    expect(svc.status).toBe(403);
    expect(svc.data.error).toMatch(/CSRF/i);
  });

  it("rejects duplicate signup with 409", async () => {
    const c = new Client();
    const email = `dup${Date.now()}@test.dev`;
    await c.post("/api/auth/signup", { name: "Ada Tester", email, password: "Passw0rd!123" });
    const second = await new Client().post("/api/auth/signup", { name: "Ada Tester", email, password: "Passw0rd!123" });
    expect(second.status).toBe(409);
  });

  it("locks the account after five failures and reports attempts", async () => {
    const c = new Client();
    const email = `lock${Date.now()}@test.dev`;
    await c.post("/api/auth/signup", { name: "Ada Tester", email, password: "Passw0rd!123" });

    for (let i = 1; i <= 4; i++) {
      const res = await new Client().post("/api/auth/login", { email, password: "wrong-password" });
      expect(res.status).toBe(401);
      expect(res.data.attemptsRemaining).toBe(5 - i);
    }
    const fifth = await new Client().post("/api/auth/login", { email, password: "wrong-password" });
    expect(fifth.data.locked).toBe(true);

    const locked = await new Client().post("/api/auth/login", { email, password: "Passw0rd!123" });
    expect(locked.status).toBe(423);
    expect(locked.data.locked).toBe(true);
  });

  it("logout bumps the token version so the old cookie is dead", async () => {
    const c = new Client();
    await c.signup();
    expect((await c.get("/api/auth/me")).status).toBe(200);
    expect((await c.post("/api/auth/logout")).status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);
  });

  it("password change invalidates the session", async () => {
    const c = new Client();
    await c.signup();
    const res = await c.patch("/api/auth/password", { current: "Passw0rd!123", next: "N3wPassword!123" });
    expect(res.status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);
  });

  it("rejects weak passwords on signup", async () => {
    const res = await new Client().post("/api/auth/signup", { name: "Ada Tester", email: `w${Date.now()}@test.dev`, password: "short" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Validation failed");
  });
});

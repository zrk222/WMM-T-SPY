import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, Client } from "./helpers";

let admin: Client;

beforeAll(async () => {
  admin = await bootstrapAdmin();
});

async function makeUser() {
  const c = new Client();
  const user = await c.signup();
  return { c, id: user.id, email: user.email };
}

describe("admin", () => {
  it("suspends a user: existing session dies and login is refused", async () => {
    const { c, id } = await makeUser();
    expect((await c.get("/api/auth/me")).status).toBe(200);

    expect((await admin.patch(`/api/admin/users?id=${id}`, { banned: true })).status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);

    const login = await c.login((await admin.get("/api/admin/users")).data.items.find((u: { id: string }) => u.id === id).email);
    expect(login.status).toBe(403);
    expect(login.data.banned).toBe(true);
  });

  it("restores a suspended user", async () => {
    const { c, id } = await makeUser();
    await admin.patch(`/api/admin/users?id=${id}`, { banned: true });
    await admin.patch(`/api/admin/users?id=${id}`, { banned: false });
    const email = (await admin.get("/api/admin/users")).data.items.find((u: { id: string }) => u.id === id).email;
    expect((await new Client().login(email)).status).toBe(200);
    expect((await c.login(email)).status).toBe(200);
  });

  it("cannot suspend yourself", async () => {
    const me = (await admin.get("/api/auth/me")).data.user;
    const res = await admin.patch(`/api/admin/users?id=${me.id}`, { banned: true });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/yourself/);
  });

  it("refuses to demote the last admin", async () => {
    const admins = (await admin.get("/api/admin/users")).data.items.filter((u: { role: string }) => u.role === "admin");
    if (admins.length === 1) {
      const res = await admin.patch(`/api/admin/users?id=${admins[0].id}`, { role: "operator" });
      expect(res.status).toBe(409);
    } else {
      const other = admins.find((u: { id: string }) => u.id !== (admins[0].id as string));
      expect((await admin.patch(`/api/admin/users?id=${other.id}`, { role: "operator" })).status).toBe(200);
    }
  });

  it("blocks non-admins from the admin API", async () => {
    const c = new Client();
    await c.signup(undefined, "team");
    expect((await c.get("/api/admin/users")).status).toBe(403);
  });

  it("writes audit rows for admin actions", async () => {
    const { id } = await makeUser();
    await admin.patch(`/api/admin/users?id=${id}`, { plan: "team" });
    const audit = await admin.get("/api/admin/audit");
    expect(audit.data.items.some((a: { action: string; entityId: string }) => a.action === "admin.user_update" && a.entityId === id)).toBe(true);
  });
});

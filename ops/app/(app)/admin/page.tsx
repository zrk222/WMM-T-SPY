import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminRow } from "./admin-row";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = (await currentUser())!;
  if (user.role !== "admin") redirect("/dashboard");
  const db = await getDb();
  const [users, audit] = await Promise.all([
    db.collection("users").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
    db.collection("audit").find({}).sort({ at: -1 }).limit(50).toArray(),
  ]);

  return (
    <>
      <h1>Admin</h1>
      <p className="lead">Users, plans and audit. Role comes from the database on every request.</p>
      <h2>Users</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Plan</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <AdminRow
              key={String(u._id)}
              user={{ id: String(u._id), email: String(u.email), role: String(u.role), plan: String(u.plan), banned: Boolean(u.bannedAt) }}
            />
          ))}
        </tbody>
      </table>
      <h2>Audit</h2>
      <div className="panel mono" style={{ maxHeight: 380, overflow: "auto" }}>
        {audit.map((a) => (
          <div key={String(a._id)} className="muted">
            {new Date(a.at as Date).toISOString().slice(0, 19)} {String(a.actor)} {String(a.action)} {String(a.entityId ?? "")}
          </div>
        ))}
      </div>
    </>
  );
}

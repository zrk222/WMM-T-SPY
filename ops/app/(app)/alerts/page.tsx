import { currentUser } from "@/lib/auth";
import { Alerts } from "./alerts";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = (await currentUser())!;
  return (
    <>
      <h1>Alerts</h1>
      <p className="lead">In-app rules over open incidents.</p>
      {user.role !== "viewer" ? <Alerts /> : <p className="muted">Viewers see rules read-only; ask an operator to add one.</p>}
    </>
  );
}

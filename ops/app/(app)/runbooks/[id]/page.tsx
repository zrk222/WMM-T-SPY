import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { runbooks } from "@/lib/collections";
import { currentUser } from "@/lib/auth";
import { RunLog } from "./run-log";

export const dynamic = "force-dynamic";

export default async function RunbookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const rb = await (await runbooks()).findOne({ _id: new ObjectId(id) });
  if (!rb) notFound();
  const user = (await currentUser())!;
  return (
    <>
      <p className="muted">
        <Link href="/runbooks">â† Runbooks</Link>
      </p>
      <h1>{rb.name}</h1>
      <ol className="panel">
        {rb.steps.map((s, i) => (
          <li key={i} style={{ marginBottom: 12 }}>
            <strong>{s.title}</strong>
            {s.command && <pre>{s.command}</pre>}
          </li>
        ))}
      </ol>
      <h2>Executions</h2>
      {user.role !== "viewer" ? <RunLog runbookId={id} /> : <p className="muted">Viewers cannot log runs.</p>}
    </>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 520 }}>
      <p className="mono muted">404</p>
      <h1>Page not found</h1>
      <p className="lead">That page does not exist or moved.</p>
      <Link href="/">Back to CloudOps</Link>
    </main>
  );
}

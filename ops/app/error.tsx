"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ maxWidth: 520 }}>
      <h1>Something broke</h1>
      <p className="lead">The server hit an unexpected error.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}

import Link from "next/link";
import type { NextPageContext } from "next";

export default function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h1>{statusCode ?? "Error"}</h1>
      <p>{statusCode === 404 ? "Page not found." : "Unexpected error."}</p>
      <Link href="/">Back to CloudOps</Link>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => ({
  statusCode: res?.statusCode ?? err?.statusCode ?? 404,
});

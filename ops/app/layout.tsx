import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CloudOps Console", template: "%s · CloudOps Console" },
  description: "Operational console for services, incidents, deploys, runbooks and SLOs, with an MCP agent surface.",
  metadataBase: new URL("https://app.local"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

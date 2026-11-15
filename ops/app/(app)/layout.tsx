import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LogoutButton } from "./logout";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <>
      <header className="top">
        <Link className="brand" href="/dashboard">
          CloudOps
        </Link>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <Link href="/services">Services</Link>
          <Link href="/incidents">Incidents</Link>
          <Link href="/search">Search</Link>
          <Link href="/deploys">Deploys</Link>
          <Link href="/runbooks">Runbooks</Link>
          <Link href="/settings">Settings</Link>
          {user.role === "admin" && <Link href="/admin">Admin</Link>}
        </nav>
        <span className="spacer" />
        <span className="who">
          {user.name} Â· {user.role} Â· {user.plan}
        </span>
        <LogoutButton />
      </header>
      <main>{children}</main>
    </>
  );
}

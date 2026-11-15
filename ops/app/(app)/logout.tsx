"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="ghost"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

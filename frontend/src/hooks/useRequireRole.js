"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, dashboardPathForRole } from "@/lib/auth";

// Blocks access unless logged in AND with the exact required role.
export function useRequireRole(requiredRole) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser().then((fetchedUser) => {
      if (cancelled) return;

      if (!fetchedUser) {
        // Not logged in at all — no bypassing this by typing the URL directly.
        router.replace("/login");
        return;
      }

      if (fetchedUser.role !== requiredRole) {
        // Logged in, but wrong role — send them to where they actually belong.
        router.replace(dashboardPathForRole(fetchedUser.role));
        return;
      }

      setUser(fetchedUser);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  return { user, checking };
}
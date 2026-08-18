"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, dashboardPathForRole } from "@/lib/api";

// If already logged in, bounce away to the correct dashboard instead of
// showing the landing/login page again.
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser().then((user) => {
      if (cancelled) return;
      if (user) {
        router.replace(dashboardPathForRole(user.role));
      } else {
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return checking; // true while we're still finding out — render nothing/a spinner until false
}
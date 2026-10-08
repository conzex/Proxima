"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore, useHydrated } from "@/lib/auth-store";
import type { MeResponse } from "@/lib/types";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clear);
  const mfaSetupRequired = useAuthStore((s) => s.mfaSetupRequired);
  const setMfaSetupRequired = useAuthStore((s) => s.setMfaSetupRequired);
  const [validated, setValidated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Session is httpOnly — validate in parallel (setup gate + profile) for fewer round trips.
  useEffect(() => {
    if (!hydrated) return;
    let active = true;

    (async () => {
      try {
        const [setupRes, meRes] = await Promise.all([
          api.get<{ setupComplete: boolean }>("/setup/status"),
          api.get<MeResponse>("/auth/me"),
        ]);
        if (!active) return;

        if (!setupRes.data.setupComplete) {
          clearAuth();
          setRedirecting(true);
          router.replace("/setup");
          return;
        }

        const u = meRes.data.user;
        setUser({ id: u.id, email: u.email, role: u.role, displayName: u.displayName });
        setMfaSetupRequired(!!u.mfaSetupRequired);
        setValidated(true);
      } catch {
        if (!active) return;
        setRedirecting(true);
        router.replace("/login");
      }
    })();

    return () => {
      active = false;
    };
  }, [hydrated, router, setUser, clearAuth, setMfaSetupRequired]);

  useEffect(() => {
    if (hydrated && validated && !user) router.replace("/login");
  }, [hydrated, validated, user, router]);

  useEffect(() => {
    if (hydrated && validated && mfaSetupRequired && !pathname.startsWith("/security")) {
      router.replace("/security");
    }
  }, [hydrated, validated, mfaSetupRequired, pathname, router]);

  if (redirecting) return null;

  const optimistic = hydrated && !!user && !validated;

  if (!hydrated || (!validated && !optimistic) || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading Proxima…
      </div>
    );
  }

  return <>{children}</>;
}

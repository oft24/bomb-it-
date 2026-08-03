"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

/** Kicks off Supabase session restoration + the auth-state listener once, client-side only. */
export function AuthProvider() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
  return null;
}

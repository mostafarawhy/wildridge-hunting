"use client";

import { useCallback } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";

export function useSignOut() {
  return useCallback(async () => {
    useAuthBusyStore.getState().begin("sign-out");
    try {
      const { redirectUrl } = await logoutAction();
      window.location.assign(redirectUrl);
    } catch {
      useAuthBusyStore.getState().end();
    }
  }, []);
}

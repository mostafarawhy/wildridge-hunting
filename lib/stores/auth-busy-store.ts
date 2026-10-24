import { create } from "zustand";

export type AuthTransition = "sign-in" | "sign-out";

interface AuthBusyStore {
  pending: AuthTransition | null;
  begin: (transition: AuthTransition) => void;
  end: () => void;
}

export const useAuthBusyStore = create<AuthBusyStore>((set) => ({
  pending: null,
  begin: (transition) => set({ pending: transition }),
  end: () => set({ pending: null }),
}));

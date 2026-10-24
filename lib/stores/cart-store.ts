import { create } from "zustand";
import type { CartProjection } from "@/lib/db/queries/cart";

interface CartStore {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  cart: CartProjection | null;
  setCart: (cart: CartProjection | null) => void;
  pendingCount: number;
  isPending: boolean;
  beginPending: () => void;
  endPending: () => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
}

export const useCartStore = create<CartStore>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  cart: null,
  setCart: (cart) => set({ cart }),
  pendingCount: 0,
  isPending: false,
  beginPending: () =>
    set((s) => {
      const pendingCount = s.pendingCount + 1;
      return { pendingCount, isPending: pendingCount > 0 };
    }),
  endPending: () =>
    set((s) => {
      const pendingCount = Math.max(0, s.pendingCount - 1);
      return { pendingCount, isPending: pendingCount > 0 };
    }),
  isAuthenticated: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
}));

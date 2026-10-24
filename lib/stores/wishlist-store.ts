import { create } from "zustand";

interface WishlistStore {
  skus: Set<string>;
  isAuthenticated: boolean;
  setState: (payload: { skus: Set<string>; isAuthenticated: boolean }) => void;
  add: (sku: string) => void;
  remove: (sku: string) => void;
  has: (sku: string) => boolean;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  skus: new Set(),
  isAuthenticated: false,
  setState: ({ skus, isAuthenticated }) => set({ skus, isAuthenticated }),
  add: (sku) => set((prev) => ({ skus: new Set(prev.skus).add(sku) })),
  remove: (sku) => {
    set((prev) => {
      const next = new Set(prev.skus);
      next.delete(sku);
      return { skus: next };
    });
  },
  has: (sku) => get().skus.has(sku),
}));

import { create } from "zustand";
import { BRAND } from "@/lib/config/brand";
import { persist } from "zustand/middleware";

export interface QuoteLineAddon {
  addonId: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
}

export interface QuoteLine {
  lineId: string;
  productSku: string;
  slugEn: string;
  categorySlug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: string;
  primaryImageKey: string | null;
  quantity: number;
  selectedAddons: QuoteLineAddon[];
}

interface QuoteStore {
  lines: QuoteLine[];
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addLine: (line: Omit<QuoteLine, "lineId">) => void;
  updateQty: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
}

function addonSetKey(addonIds: string[]): string {
  return [...addonIds].sort().join(",");
}

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      openDrawer: () => set({ open: true }),
      closeDrawer: () => set({ open: false }),
      addLine: (line) =>
        set((state) => {
          const incomingKey = addonSetKey(
            line.selectedAddons.map((a) => a.addonId),
          );
          const existingIndex = state.lines.findIndex(
            (l) =>
              l.productSku === line.productSku &&
              addonSetKey(l.selectedAddons.map((a) => a.addonId)) ===
                incomingKey,
          );
          if (existingIndex !== -1) {
            const updated = state.lines.map((l, i) =>
              i === existingIndex
                ? { ...l, quantity: l.quantity + line.quantity }
                : l,
            );
            return { lines: updated };
          }
          return {
            lines: [...state.lines, { ...line, lineId: crypto.randomUUID() }],
          };
        }),
      updateQty: (lineId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.lineId === lineId ? { ...l, quantity: Math.max(1, quantity) } : l,
          ),
        })),
      removeLine: (lineId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.lineId !== lineId),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: `${BRAND.storageKeyPrefix}-quote`,
      version: 1,
      migrate: (persisted) => {
        const lines = (persisted as { lines?: QuoteLine[] } | null)?.lines;
        return {
          lines: Array.isArray(lines)
            ? lines.map((l) => ({ ...l, selectedAddons: [] }))
            : [],
        };
      },
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export const selectQuoteCount = (s: QuoteStore) => s.lines.length;

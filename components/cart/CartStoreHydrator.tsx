"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/stores/cart-store";
import type { CartProjection } from "@/lib/db/queries/cart";

interface CartStoreHydratorProps {
  initialCart: CartProjection | null;
  isAuthenticated: boolean;
}

export default function CartStoreHydrator({
  initialCart,
  isAuthenticated,
}: CartStoreHydratorProps) {
  const setCart = useCartStore((s) => s.setCart);
  const setIsAuthenticated = useCartStore((s) => s.setIsAuthenticated);

  useEffect(() => {
    setCart(initialCart);
  }, [initialCart, setCart]);

  useEffect(() => {
    setCart(initialCart);
    setIsAuthenticated(isAuthenticated);
  }, [initialCart, isAuthenticated, setCart, setIsAuthenticated]);

  return null;
}

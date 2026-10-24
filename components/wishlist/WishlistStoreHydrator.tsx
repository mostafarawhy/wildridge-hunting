"use client";

import { useEffect } from "react";
import { useWishlistStore } from "@/lib/stores/wishlist-store";

interface WishlistStoreHydratorProps {
  initialSkus: string[];
  isAuthenticated: boolean;
}

export default function WishlistStoreHydrator({
  initialSkus,
  isAuthenticated,
}: WishlistStoreHydratorProps) {
  const setState = useWishlistStore((s) => s.setState);

  useEffect(() => {
    setState({ skus: new Set(initialSkus), isAuthenticated });
  }, [initialSkus, isAuthenticated, setState]);

  return null;
}

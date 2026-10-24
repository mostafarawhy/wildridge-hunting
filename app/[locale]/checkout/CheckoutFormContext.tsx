"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { ResolvedShippingMethod } from "@/lib/db/queries/checkout";
import { getShippingForAddress } from "@/lib/actions/shipping";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import { redeemCapPoints, type RedeemRule } from "@/lib/utils/loyalty-points";

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  freeShipping: boolean;
}

interface CheckoutFormState {
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  selectAddress: (id: string) => Promise<void>;
  marketingOptIn: boolean;
  setMarketingOptIn: (v: boolean) => void;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  isPlacingOrder: boolean;
  setIsPlacingOrder: (v: boolean) => void;
  methods: ResolvedShippingMethod[];
  selectedMethodId: string | null;
  setSelectedMethodId: (id: string | null) => void;
  isResolvingShipping: boolean;
  shippingError: string | null;
  quoteRequired: boolean;
  freeShippingThresholdAed: number | null;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (coupon: AppliedCoupon) => void;
  clearCoupon: () => void;
  availableReward: AppliedCoupon | null;
  pointsBalance: number;
  redeemRule: RedeemRule;
  pointsCap: number;
  pointsInEffect: number;
  applyPoints: (n: number) => void;
  clearPoints: () => void;
}

const CheckoutFormContext = createContext<CheckoutFormState | null>(null);

export function CheckoutFormProvider({
  children,
  defaultAddressId,
  initialMethods,
  initialSelectedMethodId,
  initialAvailableReward,
  initialQuoteRequired,
  initialFreeShippingThresholdAed,
  pointsBalance,
  redeemRule,
  goodsSubtotalAed,
}: {
  children: ReactNode;
  defaultAddressId: string | null;
  initialMethods: ResolvedShippingMethod[];
  initialSelectedMethodId: string | null;
  initialAvailableReward: AppliedCoupon | null;
  initialQuoteRequired: boolean;
  initialFreeShippingThresholdAed: number | null;
  pointsBalance: number;
  redeemRule: RedeemRule;
  goodsSubtotalAed: number;
}) {
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddressId,
  );
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [methods, setMethods] = useState<ResolvedShippingMethod[]>(initialMethods);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    initialSelectedMethodId,
  );
  const [isResolvingShipping, setIsResolvingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [quoteRequired, setQuoteRequired] = useState<boolean>(initialQuoteRequired);
  const [freeShippingThresholdAed, setFreeShippingThresholdAed] = useState<
    number | null
  >(initialFreeShippingThresholdAed);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const applyCoupon = (coupon: AppliedCoupon) => setAppliedCoupon(coupon);
  const clearCoupon = () => setAppliedCoupon(null);
  const [availableReward] = useState<AppliedCoupon | null>(
    initialAvailableReward,
  );
  const [appliedPoints, setAppliedPoints] = useState(0);
  const pointsGoodsDiscount =
    appliedCoupon && !appliedCoupon.freeShipping
      ? Math.min(appliedCoupon.discountAmount, goodsSubtotalAed)
      : 0;
  const pointsCap = Math.min(
    pointsBalance,
    redeemCapPoints(
      roundMoney(Math.max(0, sumMoney([goodsSubtotalAed, -pointsGoodsDiscount]))).toFixed(2),
      redeemRule,
    ),
  );
  const pointsInEffect =
    !quoteRequired && appliedPoints >= redeemRule.minPoints && appliedPoints <= pointsCap
      ? appliedPoints
      : 0;

  async function selectAddress(id: string) {
    setSelectedAddressId(id);
    setIsResolvingShipping(true);
    setShippingError(null);
    const res = await getShippingForAddress(id);
    setIsResolvingShipping(false);
    if (!res.success) {
      setShippingError(res.error);
      return;
    }
    setMethods(res.data.methods);
    setSelectedMethodId(res.data.selectedMethodId);
    setQuoteRequired(res.data.quoteRequired);
    setFreeShippingThresholdAed(res.data.freeShippingThresholdAed);
  }

  return (
    <CheckoutFormContext.Provider
      value={{
        selectedAddressId,
        setSelectedAddressId,
        selectAddress,
        marketingOptIn,
        setMarketingOptIn,
        termsAccepted,
        setTermsAccepted,
        isPlacingOrder,
        setIsPlacingOrder,
        methods,
        selectedMethodId,
        setSelectedMethodId,
        isResolvingShipping,
        shippingError,
        quoteRequired,
        freeShippingThresholdAed,
        appliedCoupon,
        applyCoupon,
        clearCoupon,
        availableReward,
        pointsBalance,
        redeemRule,
        pointsCap,
        pointsInEffect,
        applyPoints: (n: number) => setAppliedPoints(n),
        clearPoints: () => setAppliedPoints(0),
      }}
    >
      {children}
    </CheckoutFormContext.Provider>
  );
}

export function useCheckoutForm(): CheckoutFormState {
  const ctx = useContext(CheckoutFormContext);
  if (!ctx) {
    throw new Error("useCheckoutForm must be used within CheckoutFormProvider");
  }
  return ctx;
}

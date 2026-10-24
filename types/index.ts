export type Locale = "en" | "ar" | "ru";

export type UserRole = "CUSTOMER" | "ADMIN" | "RECEPTIONIST";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "PAYMENT_FAILED";

export type B2BStatus = "PENDING" | "APPROVED" | "REJECTED";

export type QuoteStatus = "NEW" | "CONTACTED" | "QUOTED" | "CLOSED";

export type VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  category: string;
  inStock: boolean;
  requiresVerification: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  addOns: CartAddOn[];
  image: string;
}

export interface CartAddOn {
  id: string;
  name: string;
  price: number;
}

export interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  slug: string;
  image: string;
}


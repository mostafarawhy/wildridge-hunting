import type { FocalPoint } from "@/lib/utils/focal-point";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavColumn extends NavLink {
  links: NavLink[];
}

export interface NavItem extends NavLink {
  columns?: NavColumn[];
  megaImage?: string;
  megaFocus?: FocalPoint;
}

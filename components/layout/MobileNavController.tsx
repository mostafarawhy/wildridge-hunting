"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HamburgerIcon } from "@/components/ui";
import Drawer from "@/components/ui/Drawer";
import MobileMenu from "./MobileMenu";
import type { NavItem } from "./nav-types";

interface SessionUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  items: NavItem[];
  sessionUser: SessionUser | null;
}

export default function MobileNavController({ items, sessionUser }: Props) {
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={tNav("aria_open_menu")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden transition-opacity duration-150 hover:opacity-70"
        style={{ color: "var(--color-content-primary)" }}
      >
        <HamburgerIcon />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} ariaLabel="Menu">
        <MobileMenu
          items={items}
          sessionUser={sessionUser}
          onClose={() => setOpen(false)}
        />
      </Drawer>
    </>
  );
}

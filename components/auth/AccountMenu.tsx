"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import AccountMenuButton from "./AccountMenuButton";
import LoggedInMenu from "./LoggedInMenu";
import type { ShopMode } from "@/lib/utils/shop-mode";
import { BRAND } from "@/lib/config/brand";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";

interface Session {
  id: string;
  name: string | null;
  email: string;
}

interface AccountMenuProps {
  session: Session | null;
  canUseBusinessMode?: boolean;
  shopMode?: ShopMode;
}

export default function AccountMenu({
  session,
  canUseBusinessMode = false,
  shopMode = "PERSONAL",
}: AccountMenuProps) {
  const tAuth = useTranslations("auth");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pending = useAuthBusyStore((s) => s.pending);
  const end = useAuthBusyStore((s) => s.end);
  const signedIn = session !== null;
  const busy = (pending === "sign-in" && !signedIn) || (pending === "sign-out" && signedIn);

  const closeDropdown = useCallback(() => setOpen(false), []);

  function handleGuestClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("auth", "login");
    window.history.pushState(null, "", `${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if ((pending === "sign-in" && signedIn) || (pending === "sign-out" && !signedIn)) end();
  }, [pending, signedIn, end]);

  if (!session) {
    return (
      <AccountMenuButton
        open={false}
        onClick={handleGuestClick}
        ariaLabel={tAuth("signIn")}
        busy={busy}
      />
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <AccountMenuButton
        open={open}
        onClick={() => setOpen((prev) => !prev)}
        ariaLabel={`${tAuth("account")}, ${session.name ?? session.email}`}
        ariaControls="account-dropdown-panel"
        busy={busy}
        avatarSrc={BRAND.accountAvatar}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            id="account-dropdown-panel"
            key="account-dropdown"
            role="menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            style={{
              position: "absolute",
              insetInlineEnd: 0,
              top: "calc(100% + 12px)",
              width: "280px",
              backgroundColor: "var(--primitive-white)",
              border: "1px solid var(--color-shop-divider)",
              borderRadius: "var(--radius-none)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 50,
              padding: 0,
            }}
          >
            <LoggedInMenu
              session={session}
              onItemClick={closeDropdown}
              canUseBusinessMode={canUseBusinessMode}
              shopMode={shopMode}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

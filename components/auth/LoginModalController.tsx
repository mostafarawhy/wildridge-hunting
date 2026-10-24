"use client";

import DemoAccessButtons from "@/components/auth/DemoAccessButtons";
import { useCallback, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import LoginFormCompact from "@/components/auth/LoginFormCompact";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassButton from "@/components/auth/UaePassButton";
import { safeRelativePath } from "@/lib/utils/safe-redirect";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

export default function LoginModalController({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("auth.login");
  const tAuth = useTranslations("auth");
  const searchParams = useSearchParams();

  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get("auth") === "login";

  // callbackUrl: use explicit param if present, otherwise return to current page
  const callbackUrl = searchParams.get("callbackUrl") ?? pathname;

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    params.delete("callbackUrl");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname]);

  useEffect(() => {
    if (!isOpen || !signedIn) return;
    const raw = searchParams.get("callbackUrl");
    const dest = raw ? safeRelativePath(raw) : null;
    if (dest) { startNavigationProgress(); router.push(dest); }
    else closeModal();
  }, [isOpen, signedIn, searchParams, router, closeModal]);

  function handleCreateAccount() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("auth", "register");
    params.delete("callbackUrl");
    window.history.pushState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <Modal
      open={isOpen}
      onClose={closeModal}
      ariaLabel={t("title")}
      maxWidth={420}
    >
      <div style={{ padding: "2.5rem 2rem 2rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontSize: "var(--text-heading)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--color-auth-label-text)",
              marginBottom: "0.25rem",
            }}
          >
            {t("title")}
          </h2>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            {t("subtitle")}
          </p>
        </div>

        <DemoAccessButtons onSuccess={closeModal} />

        {isUaePassEnabled() && (
          <>
            {/* UAE Pass — primary method */}
            <UaePassButton callbackUrl={callbackUrl} mode="sign-in" />

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                margin: "1.25rem 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "var(--color-auth-divider)",
                }}
              />
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-auth-input-placeholder)",
                  whiteSpace: "nowrap",
                }}
              >
                {tAuth("uaePass.divider.signIn")}
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "var(--color-auth-divider)",
                }}
              />
            </div>
          </>
        )}

        {/* Email / password form */}
        <LoginFormCompact />

        {/* Register link */}
        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--color-auth-divider)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-label-text)",
            }}
          >
            {t("noAccount")}{" "}
            <button
              type="button"
              onClick={handleCreateAccount}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-auth-link)",
              }}
            >
              {t("registerLink")}
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}

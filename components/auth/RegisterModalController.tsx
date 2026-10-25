"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassButton from "@/components/auth/UaePassButton";

const RegisterFormCompact = dynamic(
  () => import("@/components/auth/RegisterFormCompact"),
  {
    ssr: false,
    loading: () => <div aria-busy="true" style={{ minHeight: 420 }} />,
  },
);

export default function RegisterModalController() {
  const t = useTranslations("auth.register");
  const tAuth = useTranslations("auth");
  const searchParams = useSearchParams();

  const pathname = usePathname();

  const isOpen = searchParams.get("auth") === "register";

  // No explicit callbackUrl support in this modal today — fall back to the
  // current page, same convention as LoginModalController.
  const callbackUrl = searchParams.get("callbackUrl") ?? pathname;

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname,
    );
  }, [searchParams, pathname]);

  const handleSuccess = useCallback(() => {
    closeModal();
  }, [closeModal]);

  return (
    <Modal
      open={isOpen}
      onClose={closeModal}
      ariaLabel={t("title")}
      maxWidth={480}
    >
      <div style={{ padding: "2.5rem 2rem 2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h2
            className="text-heading font-bold tracking-tight"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {t("title")}
          </h2>
          <p
            className="text-body-sm"
            style={{
              color: "var(--color-auth-input-placeholder)",
              marginTop: "0.25rem",
            }}
          >
            {t("subtitle")}
          </p>
        </div>

        {isUaePassEnabled() && (
          <>
            {/* UAE Pass — primary method */}
            <UaePassButton callbackUrl={callbackUrl} mode="sign-up" />

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
                {tAuth("uaePass.divider.signUp")}
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

        <RegisterFormCompact onSuccess={handleSuccess} />
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  updateProfileAction,
  changePasswordAction,
  type AccountActionErrorCode,
} from "@/lib/actions/account";
import { useSignOut } from "@/hooks/useSignOut";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface Props {
  initialName: string;
  initialPhone: string;
  initialLocale: "en" | "ar" | "ru";
  email: string;
}

const sectionCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "var(--color-action-primary)",
  margin: 0,
};

const sectionHint: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
  margin: 0,
};

function errorMessage(
  code: AccountActionErrorCode,
  t: (key: string) => string,
): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return t("errors.sessionExpired");
    case "VALIDATION_ERROR":
      return t("errors.invalidInput");
    case "INCORRECT_PASSWORD":
      return t("errors.incorrectPassword");
    case "SAME_PASSWORD":
      return t("errors.samePassword");
    case "NO_PASSWORD_SET":
      return t("errors.noPasswordSet");
    case "PASSWORD_WEAK":
      return t("errors.passwordWeak");
    case "PASSWORDS_DO_NOT_MATCH":
      return t("errors.passwordsDoNotMatch");
    default:
      return t("errors.generic");
  }
}

export default function SettingsForm({
  initialName,
  initialPhone,
  initialLocale,
  email,
}: Props) {
  const t = useTranslations("account.settings");
  const tNav = useTranslations("nav");
  const toast = useToast();
  const router = useRouter();
  const signOut = useSignOut();

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [locale, setLocale] = useState(initialLocale);
  const [profilePending, setProfilePending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfilePending(true);
    const result = await updateProfileAction({ name, phone, locale });
    setProfilePending(false);
    if (result.success) {
      toast.success(t("profileSaved"));
      if (locale !== initialLocale) {
        startNavigationProgress();
        router.replace("/account/settings", { locale });
      } else {
        router.refresh();
      }
    } else {
      toast.error(errorMessage(result.errorCode, t));
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordPending(true);
    const result = await changePasswordAction({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      await signOut();
    } else {
      setPasswordPending(false);
      toast.error(errorMessage(result.errorCode, t));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={sectionCard}>
        <div>
          <p style={sectionTitle}>{t("profileSection")}</p>
          <p style={{ ...sectionHint, marginTop: "0.25rem" }}>
            {t("profileSectionHint")}
          </p>
        </div>

        <form
          onSubmit={handleProfileSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <Input
            id="settings-name"
            label={t("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            id="settings-phone"
            label={t("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            optional={t("phoneOptional")}
            autoComplete="tel"
            type="tel"
          />
          <Input
            id="settings-email"
            label={t("email")}
            value={email}
            disabled
            hint={t("emailReadonly")}
            autoComplete="email"
            type="email"
            readOnly
          />
          <Select
            id="settings-locale"
            label={t("language")}
            hint={t("languageHint")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as "en" | "ar" | "ru")}
          >
            <option value="en">{tNav("lang_en")}</option>
            <option value="ar">{tNav("lang_ar")}</option>
            <option value="ru">{tNav("lang_ru")}</option>
          </Select>
          <div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={profilePending}
            >
              {t("saveChanges")}
            </Button>
          </div>
        </form>
      </div>

      <div style={sectionCard}>
        <div>
          <p style={sectionTitle}>{t("passwordSection")}</p>
          <p style={{ ...sectionHint, marginTop: "0.25rem" }}>
            {t("passwordSectionHint")}
          </p>
        </div>

        <form
          onSubmit={handlePasswordSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <Input
            id="settings-current-password"
            label={t("currentPassword")}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            id="settings-new-password"
            label={t("newPassword")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            id="settings-confirm-password"
            label={t("confirmPassword")}
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={passwordPending}
            >
              {t("updatePassword")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

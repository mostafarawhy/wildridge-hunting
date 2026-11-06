"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import StorePreview, { type StorePreviewLabels } from "@/components/admin/StorePreview";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
} from "@/lib/actions/store";
import { STORE_DAYS, parseMapPin, type StoreDay } from "@/lib/utils/stores";
import type { AdminStoreDetail } from "@/lib/db/queries/stores";

interface Props {
  mode: "create" | "edit";
  initial?: AdminStoreDetail;
  labels: Record<"en" | "ar" | "ru", StorePreviewLabels>;
}

const DAY_LABELS: Record<StoreDay, string> = {
  sat: "Saturday",
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

type HoursState = Record<StoreDay, { closed: boolean; open: string; close: string }>;

function defaultHours(): HoursState {
  return STORE_DAYS.reduce((acc, day) => {
    acc[day] = { closed: true, open: "", close: "" };
    return acc;
  }, {} as HoursState);
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const grid2: React.CSSProperties = {
  gap: "1rem",
};

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

function CheckmarkIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: "1rem",
          height: "1rem",
          border: "1.5px solid var(--color-auth-input-border)",
          backgroundColor: checked
            ? "var(--color-action-primary)"
            : "var(--color-auth-input-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 150ms, border-color 150ms",
        }}
      >
        {checked && <CheckmarkIcon />}
      </span>
      <span style={{ fontSize: "var(--text-body)", color: "#0b0b0b" }}>
        {label}
      </span>
    </label>
    {hint && (
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-content-tertiary)",
          margin: 0,
        }}
      >
        {hint}
      </p>
    )}
    </div>
  );
}

function Textarea({
  id,
  label,
  value,
  onChange,
  optional,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-auth-label-text)",
        }}
      >
        {label}
        {optional && (
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-normal)",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            {optional}
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.625rem 0.875rem",
          fontSize: "var(--text-body)",
          color: "var(--color-auth-input-text)",
          backgroundColor: "var(--color-auth-input-bg)",
          border: "1.5px solid var(--color-auth-input-border)",
          borderRadius: "var(--radius-none)",
          outline: "none",
          transition: "border-color 150ms",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {hint && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export default function StoreForm({ mode, initial, labels }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [nameRu, setNameRu] = useState(initial?.nameRu ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    initial?.displayOrder != null ? String(initial.displayOrder) : "0",
  );
  const [addressEn, setAddressEn] = useState(initial?.addressEn ?? "");
  const [addressAr, setAddressAr] = useState(initial?.addressAr ?? "");
  const [addressRu, setAddressRu] = useState(initial?.addressRu ?? "");
  const [pin, setPin] = useState(initial?.pin ?? "");
  const [showHours, setShowHours] = useState(initial?.showHours ?? false);
  const [hours, setHours] = useState<HoursState>(
    initial?.hours ?? defaultHours(),
  );
  const [hoursNoteEn, setHoursNoteEn] = useState(initial?.hoursNoteEn ?? "");
  const [hoursNoteAr, setHoursNoteAr] = useState(initial?.hoursNoteAr ?? "");
  const [hoursNoteRu, setHoursNoteRu] = useState(initial?.hoursNoteRu ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    initial?.descriptionEn ?? "",
  );
  const [descriptionAr, setDescriptionAr] = useState(
    initial?.descriptionAr ?? "",
  );
  const [descriptionRu, setDescriptionRu] = useState(
    initial?.descriptionRu ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function clearError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function setDayClosed(day: StoreDay, closed: boolean) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed } }));
  }

  function setDayTime(day: StoreDay, field: "open" | "close", value: string) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  function copySaturdayToAll() {
    setHours((prev) => {
      const saturday = prev.sat;
      return STORE_DAYS.reduce((acc, day) => {
        acc[day] = { ...saturday };
        return acc;
      }, {} as HoursState);
    });
  }

  const pinResult = parseMapPin(pin);

  const payload = {
    nameEn,
    nameAr,
    nameRu,
    displayOrder,
    addressEn,
    addressAr,
    addressRu,
    pin,
    showHours,
    hours,
    hoursNoteEn,
    hoursNoteAr,
    hoursNoteRu,
    phone,
    email,
    descriptionEn,
    descriptionAr,
    descriptionRu,
    isActive,
    isPrimary,
  };

  const [baseline] = useState(() => JSON.stringify(payload));
  const dirty = JSON.stringify(payload) !== baseline;
  useUnsavedGuard(dirty);

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setPending(true);

    const result =
      mode === "create"
        ? await createStoreAction(payload)
        : await updateStoreAction(initial!.id, payload);

    setPending(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        setFieldErrors(errs);
      }
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Store created." : "Store updated.");

    if (mode === "create") {
      const href = `/admin/stores/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      startNavigationProgress("/admin/stores");
      router.push("/admin/stores");
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    const result = await deleteStoreAction(initial!.id);
    setDeletePending(false);

    if (!result.success) {
      toast.error(result.error);
      setConfirmOpen(false);
      return;
    }

    toast.success("Store deleted.");
    startNavigationProgress("/admin/stores");
    router.push("/admin/stores");
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div style={card}>
            <p style={cardTitle}>Store</p>
            <div style={stack}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]" style={grid2}>
                <Input
                  id="sf-name-en"
                  label="Name (English)"
                  value={nameEn}
                  onChange={(e) => {
                    setNameEn(e.target.value);
                    clearError("nameEn");
                  }}
                  required
                  error={fieldErrors.nameEn}
                  hint="The showroom's name. English is required; empty Arabic or Russian shows the English."
                />
                <Input
                  id="sf-name-ar"
                  label="Name (Arabic)"
                  value={nameAr}
                  onChange={(e) => {
                    setNameAr(e.target.value);
                    clearError("nameAr");
                  }}
                  dir="rtl"
                  optional="optional"
                  error={fieldErrors.nameAr}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]" style={grid2}>
                <Input
                  id="sf-name-ru"
                  label="Name (Russian)"
                  value={nameRu}
                  onChange={(e) => {
                    setNameRu(e.target.value);
                    clearError("nameRu");
                  }}
                  optional="optional"
                  error={fieldErrors.nameRu}
                />
                <Input
                  id="sf-display-order"
                  label="Display Order"
                  value={displayOrder}
                  onChange={(e) => {
                    setDisplayOrder(e.target.value);
                    clearError("displayOrder");
                  }}
                  inputMode="numeric"
                  dir="ltr"
                  error={fieldErrors.displayOrder}
                  hint="Lower numbers appear first on Our Stores."
                />
              </div>
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Location</p>
            <div style={stack}>
              <Input
                id="sf-address-en"
                label="Address (English)"
                value={addressEn}
                onChange={(e) => {
                  setAddressEn(e.target.value);
                  clearError("addressEn");
                }}
                required
                error={fieldErrors.addressEn}
                hint="The street address customers drive to. English is required; others fall back to English."
              />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]" style={grid2}>
                <Input
                  id="sf-address-ar"
                  label="Address (Arabic)"
                  value={addressAr}
                  onChange={(e) => {
                    setAddressAr(e.target.value);
                    clearError("addressAr");
                  }}
                  dir="rtl"
                  optional="optional"
                  error={fieldErrors.addressAr}
                />
                <Input
                  id="sf-address-ru"
                  label="Address (Russian)"
                  value={addressRu}
                  onChange={(e) => {
                    setAddressRu(e.target.value);
                    clearError("addressRu");
                  }}
                  optional="optional"
                  error={fieldErrors.addressRu}
                />
              </div>
              <div>
                <Input
                  id="sf-pin"
                  label="Map pin"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    clearError("pin");
                  }}
                  dir="ltr"
                  required
                  hint="Paste lat, lng or a Google Maps link. The map and the directions button use it."
                  error={fieldErrors.pin}
                />
                {pinResult && (
                  <a
                    href={`https://www.google.com/maps?q=${pinResult.latitude},${pinResult.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: "0.375rem",
                      fontSize: "var(--text-body-sm)",
                      color: "#6b6b6b",
                      textDecoration: "underline",
                    }}
                  >
                    Check the pin on Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Opening hours</p>
            <div style={stack}>
              <CheckboxField
                id="sf-show-hours"
                label="Show opening hours"
                checked={showHours}
                onChange={setShowHours}
              />
              {showHours && (
                <>
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      margin: 0,
                    }}
                  >
                    Dubai time, Saturday first. A closing time at or before the opening time runs past midnight.
                  </p>
                  <div style={stack}>
                    {STORE_DAYS.map((day) => (
                      <div
                        key={day}
                        className="grid grid-cols-2 sm:grid-cols-[7rem_7rem_1fr_1fr]"
                        style={{
                          gap: "0.75rem",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-body)",
                            color: "#0b0b0b",
                          }}
                        >
                          {DAY_LABELS[day]}
                        </span>
                        <CheckboxField
                          id={`sf-day-closed-${day}`}
                          label="Closed"
                          checked={hours[day].closed}
                          onChange={(v) => setDayClosed(day, v)}
                        />
                        {!hours[day].closed && (
                          <>
                            <Input
                              id={`sf-day-open-${day}`}
                              label="Opens"
                              type="time"
                              dir="ltr"
                              value={hours[day].open}
                              onChange={(e) =>
                                setDayTime(day, "open", e.target.value)
                              }
                            />
                            <Input
                              id={`sf-day-close-${day}`}
                              label="Closes"
                              type="time"
                              dir="ltr"
                              value={hours[day].close}
                              onChange={(e) =>
                                setDayTime(day, "close", e.target.value)
                              }
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={copySaturdayToAll}
                    style={{
                      display: "inline-flex",
                      alignSelf: "flex-start",
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "#0b0b0b",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Copy Saturday to every day
                  </button>
                  {fieldErrors.hours && (
                    <p
                      role="alert"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-auth-error-text)",
                        margin: 0,
                      }}
                    >
                      {fieldErrors.hours}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]" style={grid2}>
                    <Input
                      id="sf-hours-note-en"
                      label="Hours note (English)"
                      value={hoursNoteEn}
                      onChange={(e) => setHoursNoteEn(e.target.value)}
                      optional="optional"
                      error={fieldErrors.hoursNoteEn}
                      hint="Optional, for example: Closed on public holidays."
                    />
                    <Input
                      id="sf-hours-note-ar"
                      label="Hours note (Arabic)"
                      value={hoursNoteAr}
                      onChange={(e) => setHoursNoteAr(e.target.value)}
                      dir="rtl"
                      optional="optional"
                      error={fieldErrors.hoursNoteAr}
                    />
                  </div>
                  <Input
                    id="sf-hours-note-ru"
                    label="Hours note (Russian)"
                    value={hoursNoteRu}
                    onChange={(e) => setHoursNoteRu(e.target.value)}
                    optional="optional"
                    error={fieldErrors.hoursNoteRu}
                  />
                </>
              )}
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Contact</p>
            <div style={stack}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]" style={grid2}>
                <Input
                  id="sf-phone"
                  label="Phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearError("phone");
                  }}
                  dir="ltr"
                  optional="optional"
                  error={fieldErrors.phone}
                  hint="Optional. Shown with this showroom."
                />
                <Input
                  id="sf-email"
                  label="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                  dir="ltr"
                  optional="optional"
                  error={fieldErrors.email}
                  hint="Optional. Shown with this showroom."
                />
              </div>
              <Textarea
                id="sf-description-en"
                label="Description (English)"
                value={descriptionEn}
                onChange={setDescriptionEn}
                optional="optional"
                hint="Optional. One or two sentences about this showroom."
              />
              <Textarea
                id="sf-description-ar"
                label="Description (Arabic)"
                value={descriptionAr}
                onChange={setDescriptionAr}
                optional="optional"
              />
              <Textarea
                id="sf-description-ru"
                label="Description (Russian)"
                value={descriptionRu}
                onChange={setDescriptionRu}
                optional="optional"
              />
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Visibility</p>
            <div style={stack}>
              <CheckboxField
                id="sf-is-active"
                label="Shown on the site"
                checked={isActive}
                onChange={setIsActive}
                hint="Hidden showrooms appear nowhere on the site."
              />
              <CheckboxField
                id="sf-is-primary"
                label="Main showroom"
                checked={isPrimary}
                onChange={setIsPrimary}
                hint="The main showroom appears on Contact and About. There is only one, and it must be shown."
              />
            </div>
          </div>

          <ContentSaveBar
            savedLabel={null}
            dirty={dirty}
            saveLabel={mode === "create" ? "Create Store" : "Save Changes"}
            onSave={() => {
              void handleSubmit();
            }}
            saving={pending}
            onPreview={() => setPreviewOpen(true)}
            extra={
              <>
                <Link
                  href="/admin/stores"
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#0b0b0b",
                    textDecoration: "underline",
                  }}
                >
                  Cancel
                </Link>
                {mode === "edit" && (
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "2.5rem",
                      paddingInline: "1rem",
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--font-medium)",
                      color: "#991b1b",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Delete store
                  </button>
                )}
              </>
            }
          />
        </div>
      </form>

      {previewOpen && (
        <StorePreview
          values={payload}
          labels={labels}
          initialLang="en"
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {mode === "edit" && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Delete store"
          message="This store will be removed from the site. The main showroom cannot be deleted."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isPending={deletePending}
          destructive={true}
        />
      )}
    </>
  );
}

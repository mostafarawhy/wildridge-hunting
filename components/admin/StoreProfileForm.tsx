"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { updateStoreProfileAction } from "@/lib/actions/settings";

interface Props {
  initial: {
    storeName: string;
    contactEmail: string;
    contactPhone: string;
    addressLine: string;
    instagramUrl: string;
    youtubeUrl: string;
  };
}

interface FieldErrors {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
}

export default function StoreProfileForm({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  async function handleSubmit() {
    setIsSubmitting(true);
    setFieldErrors({});

    const result = await updateStoreProfileAction(form);

    if (result.success) {
      toast.success("Store profile saved.");
      setSaved(form);
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.storeName) fe.storeName = result.fieldErrors.storeName[0];
      if (result.fieldErrors.contactEmail) fe.contactEmail = result.fieldErrors.contactEmail[0];
      if (result.fieldErrors.contactPhone) fe.contactPhone = result.fieldErrors.contactPhone[0];
      if (result.fieldErrors.addressLine) fe.addressLine = result.fieldErrors.addressLine[0];
      if (result.fieldErrors.instagramUrl) fe.instagramUrl = result.fieldErrors.instagramUrl[0];
      if (result.fieldErrors.youtubeUrl) fe.youtubeUrl = result.fieldErrors.youtubeUrl[0];
      setFieldErrors(fe);
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: "0",
      }}
    >
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <Input
            id="store-name"
            label="Store name"
            type="text"
            value={form.storeName}
            onChange={(e) => {
              setForm((f) => ({ ...f, storeName: e.target.value }));
              if (fieldErrors.storeName)
                setFieldErrors((fe) => ({ ...fe, storeName: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.storeName}
            hint="Your trading name, as customers should read it."
            optional="(optional)"
          />

          <Input
            id="contact-email"
            label="Contact email"
            type="email"
            dir="ltr"
            value={form.contactEmail}
            onChange={(e) => {
              setForm((f) => ({ ...f, contactEmail: e.target.value }));
              if (fieldErrors.contactEmail)
                setFieldErrors((fe) => ({ ...fe, contactEmail: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.contactEmail}
            hint="Where customer emails go. The Contact page topics open an email to this address."
            optional="(optional)"
          />

          <Input
            id="contact-phone"
            label="Contact phone"
            type="text"
            dir="ltr"
            value={form.contactPhone}
            onChange={(e) => {
              setForm((f) => ({ ...f, contactPhone: e.target.value }));
              if (fieldErrors.contactPhone)
                setFieldErrors((fe) => ({ ...fe, contactPhone: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.contactPhone}
            hint="International format, for example +971 4 123 4567. The WhatsApp link uses this number too."
            optional="(optional)"
          />

          <Input
            id="address-line"
            label="Registered address"
            type="text"
            value={form.addressLine}
            onChange={(e) => {
              setForm((f) => ({ ...f, addressLine: e.target.value }));
              if (fieldErrors.addressLine)
                setFieldErrors((fe) => ({ ...fe, addressLine: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.addressLine}
            hint="Your registered business address, on one line. Leave empty to hide it."
            optional="(optional)"
          />

          <Input
            id="instagram-url"
            label="Instagram link"
            type="url"
            dir="ltr"
            value={form.instagramUrl}
            onChange={(e) => {
              setForm((f) => ({ ...f, instagramUrl: e.target.value }));
              if (fieldErrors.instagramUrl)
                setFieldErrors((fe) => ({ ...fe, instagramUrl: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.instagramUrl}
            hint="A full https:// link on instagram.com. Leave empty to hide the icon."
            optional="(optional)"
          />

          <Input
            id="youtube-url"
            label="YouTube link"
            type="url"
            dir="ltr"
            value={form.youtubeUrl}
            onChange={(e) => {
              setForm((f) => ({ ...f, youtubeUrl: e.target.value }));
              if (fieldErrors.youtubeUrl)
                setFieldErrors((fe) => ({ ...fe, youtubeUrl: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.youtubeUrl}
            hint="A full https:// link on youtube.com. Leave empty to hide the icon."
            optional="(optional)"
          />
        </div>
      </div>

    </div>

      <ContentSaveBar
        savedLabel={null}
        dirty={dirty}
        saveLabel="Save"
        onSave={() => {
          void handleSubmit();
        }}
        saving={isSubmitting}
      />
    </div>
  );
}

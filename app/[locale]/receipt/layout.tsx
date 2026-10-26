import { getMessages } from "next-intl/server";
import ExtraMessages from "@/components/layout/ExtraMessages";
import { RECEIPT_MESSAGE_PATHS, pickMessages } from "@/lib/client-messages";

export default async function ReceiptMessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = pickMessages(await getMessages(), RECEIPT_MESSAGE_PATHS);
  return <ExtraMessages messages={messages}>{children}</ExtraMessages>;
}

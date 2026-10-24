import type { CSSProperties, ReactNode } from "react";
import AccountHelpLink from "@/components/account/AccountHelpLink";

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "1rem",
};

interface Props {
  helpHref: string;
  children: ReactNode;
}

export default function AccountHeaderRow({ helpHref, children }: Props) {
  return (
    <div style={rowStyle}>
      <div style={{ minWidth: 0 }}>{children}</div>
      <AccountHelpLink href={helpHref} />
    </div>
  );
}

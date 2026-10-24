export type LinkSlot = (p: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  ariaLabel?: string;
}) => React.ReactNode;

import { Link } from "@/i18n/navigation";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

function btnClass(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
) {
  return ["btn-link", `btn-link--${variant}`, `btn-link--${size}`, className]
    .filter(Boolean)
    .join(" ");
}

interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
}

export default function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a href={href} className={btnClass(variant, size, className)} {...rest}>
      {children}
    </a>
  );
}

export function LocaleButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={btnClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

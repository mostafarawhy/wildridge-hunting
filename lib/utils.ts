export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatPrice(amount: number, currency = "AED") {
  return `${currency} ${amount.toLocaleString("en-AE")}`;
}

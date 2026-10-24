import { auth } from "@/lib/auth";

export async function getSessionCustomerId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.principal !== "customer") return null;
  return session.user.id ?? null;
}

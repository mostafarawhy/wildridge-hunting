/**
 * Re-export shim for use in SERVER COMPONENTS, SERVER ACTIONS, and ROUTE HANDLERS only.
 *
 * ⚠️ DO NOT import this file from middleware.ts — it transitively pulls in
 *    bcryptjs and Prisma, which are not Edge-runtime safe.
 *    Middleware imports `auth` from `@/auth.config` instead.
 */
export { auth, signIn, signOut, handlers } from "@/auth";

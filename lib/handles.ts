/** Static destinations must never be claimed as public profile handles. */
export const RESERVED_HANDLES = new Set([
  "account",
  "admin",
  "advertising",
  "api",
  "about",
  "blog",
  "contact",
  "dashboard",
  "faq",
  "features",
  "help",
  "login",
  "onboarding",
  "pricing",
  "privacy",
  "register",
  "sentry-example-page",
  "settings",
  "sign-in",
  "sign-up",
  "support",
  "terms",
  "thanks",
  "upgraded",
  "upload",
]);

/** Returns a customer-facing reason a normalized handle cannot be claimed. */
export function getHandleError(handle: string): string | null {
  if (handle.length < 3 || handle.length > 32) {
    return "Handle must be between 3 and 32 characters";
  }
  if (!/^[a-z0-9_-]+$/.test(handle)) {
    return "Handle can only contain lowercase letters, numbers, underscores, and hyphens";
  }
  if (RESERVED_HANDLES.has(handle)) {
    return "This handle is reserved and cannot be used.";
  }
  return null;
}

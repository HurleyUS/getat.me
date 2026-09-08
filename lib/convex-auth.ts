import type { ActionCtx, MutationCtx, QueryCtx } from "../convex/_generated/server";

/** A caller-supplied account ID is never evidence of ownership. */
export async function requireOwner(ctx: QueryCtx | MutationCtx | ActionCtx, userId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Please sign in");
  if (userId !== undefined && userId !== identity.subject)
    throw new Error("You can only access your own account");
  return identity.subject;
}

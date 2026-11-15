import type { UserDoc } from "./collections";

/** Non-admins only see their own rows; admins see everything. */
export function scope(user: UserDoc, base: Record<string, unknown> = {}): Record<string, unknown> {
  return user.role === "admin" ? base : { ...base, ownerId: user._id };
}

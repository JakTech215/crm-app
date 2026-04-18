"use server";

import { getSessionUser } from "./auth";

/**
 * Returns the current session user id, or null if unauthenticated.
 * Use with inline visibility clauses on every read of a table that
 * has is_private + created_by columns:
 *
 *   const userId = await currentUserId();
 *   const vis = userId
 *     ? sql`(t.is_private = false OR t.created_by = ${userId})`
 *     : sql`t.is_private = false`;
 *   await sql`SELECT ... FROM tasks t WHERE ... AND ${vis}`;
 *
 * The alias is written inline so the fragment always matches the
 * surrounding query, avoiding dynamic identifier interpolation.
 */
export async function currentUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

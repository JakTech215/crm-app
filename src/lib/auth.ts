"use server";

import { cookies } from "next/headers";
import sql from "./db";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("authjs.session-token")?.value;
  if (!token) return null;

  const rows = await sql`
    SELECT s.user_id as id, au.email, up.role, up.full_name
    FROM public.sessions s
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN public.user_profiles up ON up.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `;
  return rows[0] || null;
}

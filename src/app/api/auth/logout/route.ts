import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import sql from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("authjs.session-token")?.value;

  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("authjs.session-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("__Secure-authjs.session-token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

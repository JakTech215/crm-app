import { NextResponse } from "next/server";
import sql from "@/lib/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const rows = await sql`SELECT id, email, encrypted_password FROM auth.users WHERE email = ${email}`;
  const user = rows[0];

  if (!user || !user.encrypted_password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.encrypted_password);

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Create session
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await sql`
    INSERT INTO public.sessions (user_id, token, expires_at)
    VALUES (${user.id}, ${token}, ${expiresAt})
  `;

  const response = NextResponse.json({ success: true });
  response.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

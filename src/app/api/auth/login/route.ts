import { NextResponse } from "next/server";
import sql from "@/lib/db";
import crypto from "crypto";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
  const user = rows[0];

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Verify bcrypt password (Supabase uses bcrypt)
  const { promisify } = await import("util");
  const scryptAsync = promisify(crypto.scrypt);

  let valid = false;
  if (user.password_hash.startsWith("$2")) {
    // bcrypt hash - use timing-safe comparison via crypto
    const bcrypt = await import("bcryptjs");
    valid = await bcrypt.compare(password, user.password_hash);
  } else {
    // scrypt hash fallback
    const [salt, hash] = user.password_hash.split(":");
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    valid = crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Create session
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
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

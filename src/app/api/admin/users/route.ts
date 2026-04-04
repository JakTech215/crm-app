import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

async function verifyAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const data = await sql`SELECT * FROM user_profiles ORDER BY created_at DESC`;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { email, full_name, role } = body;

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  try {
    // Create auth user record
    const authRows = await sql`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, is_sso_user, is_anonymous)
      VALUES (gen_random_uuid(), ${email}, '', NOW(), NOW(), NOW(), false, false)
      RETURNING id, email
    `;
    const newUser = authRows[0];

    // Create public user record
    await sql`
      INSERT INTO public.users (id, full_name, role)
      VALUES (${newUser.id}, ${full_name || null}, ${role || "user"})
    `;

    // Create profile entry
    const profileRows = await sql`
      INSERT INTO user_profiles ${sql({
        id: newUser.id,
        email,
        full_name: full_name || null,
        role: role || "user",
      })} RETURNING *
    `;

    return NextResponse.json(profileRows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { id, role, full_name } = body;

  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;

  try {
    const rows = await sql`
      UPDATE user_profiles SET ${sql(updates)} WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  try {
    await sql`DELETE FROM public.sessions WHERE user_id = ${id}`;
    await sql`DELETE FROM user_profiles WHERE id = ${id}`;
    await sql`DELETE FROM public.users WHERE id = ${id}`;
    await sql`DELETE FROM auth.users WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

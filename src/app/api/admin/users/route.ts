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
    // Create user record directly
    const userRows = await sql`
      INSERT INTO users ${sql({ email, password_hash: "" })} RETURNING *
    `;
    const newUser = userRows[0];

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
    await sql`DELETE FROM user_profiles WHERE id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

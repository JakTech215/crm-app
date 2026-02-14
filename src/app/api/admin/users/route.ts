import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { email, full_name, role } = body;

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const adminClient = getAdminClient();

  // Invite user via Supabase Admin API
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  // Create profile entry
  const supabase = await createServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id: inviteData.user.id,
      email,
      full_name: full_name || null,
      role: role || "user",
    })
    .select()
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { id, role, full_name } = body;

  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  const supabase = await createServerClient();
  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  const adminClient = getAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

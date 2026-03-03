import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // try to delete the task; server client still obeys RLS but will
  // return any rows removed so the caller can detect 0-row deletes.
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length || 0, data });
}

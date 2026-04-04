import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await sql`DELETE FROM tasks WHERE id = ${id} RETURNING *`;

    return NextResponse.json({ deleted: data.length, data: [...data] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

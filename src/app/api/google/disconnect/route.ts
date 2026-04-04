// src/app/api/google/disconnect/route.ts
// Disconnects Google Calendar integration

import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete tokens
    await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${user.id}`;

    // Delete calendar selections
    await sql`DELETE FROM google_calendar_selections WHERE user_id = ${user.id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}

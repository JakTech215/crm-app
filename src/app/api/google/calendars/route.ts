// src/app/api/google/calendars/route.ts
// Fetches user's Google Calendars list

import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string | null; expiresIn: number }> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) return { accessToken: null, expiresIn: 0 };

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in || 3600,
    };
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return { accessToken: null, expiresIn: 0 };
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get stored tokens
    const tokenRows = await sql`
      SELECT * FROM google_calendar_tokens WHERE user_id = ${user.id}
    `;
    const tokenData = tokenRows[0];

    if (!tokenData) {
      return NextResponse.json(
        { error: "Not connected to Google Calendar" },
        { status: 404 }
      );
    }

    let accessToken = tokenData.access_token;

    // Refresh proactively — 5 minutes before expiry
    const expiryDate = new Date(tokenData.token_expiry);
    const bufferMs = 5 * 60 * 1000;
    if (expiryDate.getTime() - bufferMs < Date.now()) {
      const { accessToken: newAccessToken, expiresIn } =
        await refreshAccessToken(tokenData.refresh_token);

      if (!newAccessToken) {
        // Refresh token is invalid/revoked — clear tokens so UI shows disconnected
        await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${user.id}`;
        return NextResponse.json(
          {
            error: "Token expired. Please reconnect Google Calendar.",
            reconnect: true,
          },
          { status: 401 }
        );
      }

      accessToken = newAccessToken;

      // Store actual expiry from Google's response
      const tokenExpiry = new Date(
        Date.now() + expiresIn * 1000
      ).toISOString();

      await sql`
        UPDATE google_calendar_tokens
        SET ${sql({
          access_token: newAccessToken,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })}
        WHERE user_id = ${user.id}
      `;
    }

    // Fetch calendars from Google
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!calendarResponse.ok) {
      // If Google rejects the token even after refresh, clean up
      if (calendarResponse.status === 401) {
        await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${user.id}`;
        return NextResponse.json(
          { error: "Token rejected by Google. Please reconnect.", reconnect: true },
          { status: 401 }
        );
      }
      throw new Error("Failed to fetch calendars");
    }

    const calendars = await calendarResponse.json();

    // Get user's current selections
    const selections = await sql`
      SELECT * FROM google_calendar_selections WHERE user_id = ${user.id}
    `;

    const selectedIds = new Set(selections.map((s: any) => s.calendar_id));

    // Format response
    const formattedCalendars = calendars.items.map((cal: any) => ({
      id: cal.id,
      name: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      selected: selectedIds.has(cal.id),
    }));

    return NextResponse.json({ calendars: formattedCalendars });
  } catch (error) {
    console.error("Error fetching calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { calendarId, calendarName, selected } = await request.json();

    if (selected) {
      // Add to selections
      await sql`
        INSERT INTO google_calendar_selections ${sql({
          user_id: user.id,
          calendar_id: calendarId,
          calendar_name: calendarName,
          is_selected: true,
        })}
        ON CONFLICT (user_id, calendar_id) DO UPDATE SET
          calendar_name = EXCLUDED.calendar_name,
          is_selected = EXCLUDED.is_selected
      `;
    } else {
      // Remove from selections
      await sql`
        DELETE FROM google_calendar_selections
        WHERE user_id = ${user.id} AND calendar_id = ${calendarId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating calendar selection:", error);
    return NextResponse.json(
      { error: "Failed to update selection" },
      { status: 500 }
    );
  }
}

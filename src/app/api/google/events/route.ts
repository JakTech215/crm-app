// src/app/api/google/events/route.ts
// Fetches events from user's selected Google Calendars

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string | null; expiresIn: number }> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return { accessToken: null, expiresIn: 0 };

    const tokens = await response.json();
    return { accessToken: tokens.access_token, expiresIn: tokens.expires_in || 3600 };
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return { accessToken: null, expiresIn: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start'); // YYYY-MM-DD
    const end = searchParams.get('end'); // YYYY-MM-DD

    if (!start || !end) {
      return NextResponse.json({ error: 'Start and end dates required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ events: [] }); // Return empty if not connected
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired
    if (new Date(tokenData.token_expiry) < new Date()) {
      // Refresh the token
      const { accessToken: newAccessToken, expiresIn } = await refreshAccessToken(tokenData.refresh_token);
      
      if (!newAccessToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }

      accessToken = newAccessToken;

      // Update stored token
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
      
      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: newAccessToken,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Get selected calendars
    const { data: selections } = await supabase
      .from('google_calendar_selections')
      .select('calendar_id, calendar_name')
      .eq('user_id', user.id)
      .eq('is_selected', true);

    if (!selections || selections.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // Fetch events from each selected calendar
    const allEvents: any[] = [];

    for (const selection of selections) {
      try {
        const timeMin = new Date(start + 'T00:00:00').toISOString();
        const timeMax = new Date(end + 'T23:59:59').toISOString();

        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(selection.calendar_id)}/events?` +
          `timeMin=${encodeURIComponent(timeMin)}&` +
          `timeMax=${encodeURIComponent(timeMax)}&` +
          `singleEvents=true&` +
          `orderBy=startTime`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!eventsResponse.ok) {
          console.error(`Failed to fetch events for calendar ${selection.calendar_id}`);
          continue;
        }

        const eventsData = await eventsResponse.json();

        // Format events
        const formattedEvents = eventsData.items?.map((event: any) => ({
          id: event.id,
          title: event.summary || '(No title)',
          description: event.description,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          allDay: !event.start?.dateTime, // If no dateTime, it's an all-day event
          calendarName: selection.calendar_name,
          calendarId: selection.calendar_id,
          source: 'google',
          location: event.location,
          attendees: event.attendees?.map((a: any) => a.email) || [],
        })) || [];

        allEvents.push(...formattedEvents);
      } catch (error) {
        console.error(`Error fetching events for calendar ${selection.calendar_id}:`, error);
      }
    }

    return NextResponse.json({ events: allEvents });
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

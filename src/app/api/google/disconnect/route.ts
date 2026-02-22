// src/app/api/google/disconnect/route.ts
// Disconnects Google Calendar integration

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete tokens
    await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id);

    // Delete calendar selections
    await supabase
      .from('google_calendar_selections')
      .delete()
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

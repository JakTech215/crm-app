'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
  selected: boolean;
}

export default function GoogleCalendarSettings() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [savingCalendar, setSavingCalendar] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConnected(true);
        await fetchCalendars();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/google/calendars');
      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/google/auth';
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will remove all synced events from your dashboard.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setConnected(false);
        setCalendars([]);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleCalendar = async (calendarId: string, calendarName: string, currentlySelected: boolean) => {
    setSavingCalendar(calendarId);
    try {
      const response = await fetch('/api/google/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          calendarName,
          selected: !currentlySelected,
        }),
      });

      if (response.ok) {
        setCalendars(calendars.map(cal =>
          cal.id === calendarId
            ? { ...cal, selected: !currentlySelected }
            : cal
        ));
      }
    } catch (error) {
      console.error('Error toggling calendar:', error);
    } finally {
      setSavingCalendar(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Integration
          </CardTitle>
          <CardDescription>Sync your Google Calendar events to the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>Sync your Google Calendar events to the dashboard</CardDescription>
          </div>
          {connected && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to see all your events in one place on the dashboard.
            </p>
            <Button onClick={handleConnect} className="w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4" />
              Connect Google Calendar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Select Calendars to Sync</h4>
                <span className="text-xs text-muted-foreground">
                  {calendars.filter(c => c.selected).length} of {calendars.length} selected
                </span>
              </div>
              
              {calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calendars found</p>
              ) : (
                <div className="space-y-2">
                  {calendars.map((calendar) => (
                    <label
                      key={calendar.id}
                      className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={calendar.selected}
                        onCheckedChange={() => handleToggleCalendar(calendar.id, calendar.name, calendar.selected)}
                        disabled={savingCalendar === calendar.id}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{calendar.name}</span>
                          {calendar.primary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                          {savingCalendar === calendar.id && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {calendar.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {calendar.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full sm:w-auto"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Disconnect Google Calendar
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will remove all Google Calendar events from your dashboard.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

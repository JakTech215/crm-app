'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import MeetingNoteForm from './MeetingNoteForm';
import MeetingNoteCard from './MeetingNoteCard';

interface MeetingNote {
  id: string;
  title: string;
  meeting_date: string;
  project_id: string | null;
  contact_id: string | null;
  employee_id: string | null;
  created_at: string;
  projects?: { name: string };
  contacts?: { first_name: string; last_name: string };
  employees?: { first_name: string; last_name: string };
}
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MeetingNotesView() {
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchMeetingNotes = async () => {
    const { data, error } = await supabase
      .from('meeting_notes')
      .select(`
        *,
        projects(name),
        contacts(first_name, last_name),
        employees(first_name, last_name)
      `)
      .order('meeting_date', { ascending: false });

    if (!error && data) {
      setMeetingNotes(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMeetingNotes();
  }, []);

  const handleSave = () => {
    fetchMeetingNotes(); // Refresh list
  };

  return (
    <div>
      <MeetingNoteForm onSave={handleSave} />
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Meeting Notes</h2>
        {loading ? (
          <p>Loading...</p>
        ) : meetingNotes.length === 0 ? (
          <p className="text-gray-500">No meeting notes yet. Create your first one above!</p>
        ) : (
          <div className="grid gap-4">
            {meetingNotes.map((note) => (
              <MeetingNoteCard key={note.id} note={note} onUpdate={fetchMeetingNotes} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
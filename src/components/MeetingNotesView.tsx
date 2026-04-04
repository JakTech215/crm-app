'use client';

import { useState, useEffect } from 'react';
import { fetchMeetingNotes } from './actions';
import MeetingNoteForm from './MeetingNoteForm';
import MeetingNoteCard from './MeetingNoteCard';

interface MeetingNote {
  id: string;
  title: string;
  meeting_date: string;
  project_id: string | null;
  contact_id: string | null;
  employee_id: string | null;
  event_id: string | null;
  created_at: string;
  projects?: { name: string };
  contacts?: { first_name: string; last_name: string };
  employees?: { first_name: string; last_name: string };
  events?: { title: string };
}

export default function MeetingNotesView() {
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);

  const loadMeetingNotes = async () => {
    const data = await fetchMeetingNotes();
    setMeetingNotes(data as MeetingNote[]);
    setLoading(false);
  };

  useEffect(() => {
    loadMeetingNotes();
  }, []);

  const handleSave = () => {
    loadMeetingNotes();
    setEditingNote(null);
  };

  const handleEdit = (note: MeetingNote) => {
    setEditingNote(note);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
  };

  return (
    <div>
      <MeetingNoteForm
        onSave={handleSave}
        editingNote={editingNote}
        onCancelEdit={handleCancelEdit}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Meeting Notes</h2>
        {loading ? (
          <p>Loading...</p>
        ) : meetingNotes.length === 0 ? (
          <p className="text-gray-500">No meeting notes yet. Create your first one above!</p>
        ) : (
          <div className="grid gap-4">
            {meetingNotes.map((note) => (
              <MeetingNoteCard
                key={note.id}
                note={note}
                onUpdate={loadMeetingNotes}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

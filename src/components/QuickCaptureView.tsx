'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import TaskCreationModal from './TaskCreationModal';

export default function QuickCaptureView() {
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contactId, setContactId] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchNotes();
    fetchOptions();
  }, []);

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes_standalone')
      .select(`
        *,
        projects(name),
        contacts(first_name, last_name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setNotes(data);
  };

  const fetchOptions = async () => {
    const [projectsRes, contactsRes] = await Promise.all([
      supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
      supabase.from('contacts').select('id, first_name, last_name').eq('status', 'active').order('first_name')
    ]);
    
    if (projectsRes.data) setProjects(projectsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('notes_standalone').insert({
      content,
      project_id: projectId || null,
      contact_id: contactId || null,
      created_by: user?.id
    });
    
    setContent('');
    setProjectId('');
    setContactId('');
    setSaving(false);
    fetchNotes();
  };

  const openTaskModal = (note: any) => {
    setSelectedNote(note);
    setModalOpen(true);
  };

  const handleTaskCreated = async (taskId: string) => {
    // Delete the note after task is created
    if (selectedNote) {
      await supabase
        .from('notes_standalone')
        .delete()
        .eq('id', selectedNote.id);
      
      fetchNotes();
      setSelectedNote(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Entry Form */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4">Quick Note Entry</h3>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full border rounded px-3 py-2 min-h-[120px] mb-4"
          placeholder="Type your note here..."
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Link to Project (optional)</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Link to Contact (optional)</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>

      {/* Saved Notes List */}
      <div className="space-y-3">
        <h3 className="font-semibold">Saved Notes</h3>
        {notes.length === 0 ? (
          <p className="text-gray-500 text-sm">No notes yet. Create your first quick note above!</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white p-4 rounded-lg border">
              <p className="text-gray-800 mb-2">{note.content}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {note.projects && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      📁 {note.projects.name}
                    </span>
                  )}
                  {note.contacts && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      👤 {note.contacts.first_name} {note.contacts.last_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <button
                  onClick={() => openTaskModal(note)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  → Convert to Task
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Creation Modal */}
      {modalOpen && selectedNote && (
        <TaskCreationModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleTaskCreated}
          defaultTitle={selectedNote.content.substring(0, 100)}
          defaultDescription={selectedNote.content}
          defaultProjectId={selectedNote.project_id}
          defaultContactId={selectedNote.contact_id}
          sourceType="quick_note"
          sourceId={selectedNote.id}
        />
      )}
    </div>
  );
}
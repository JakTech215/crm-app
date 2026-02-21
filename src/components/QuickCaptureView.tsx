'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import TaskCreationModal from './TaskCreationModal';
import { X, Edit2 } from 'lucide-react';

export default function QuickCaptureView() {
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contactId, setContactId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [eventId, setEventId] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchNotes();
    fetchOptions();
  }, []);

  // Auto-load note for editing from URL param (from dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editNoteId = params.get('editNote');
    
    if (editNoteId && notes.length > 0) {
      const noteToEdit = notes.find(n => n.id === editNoteId);
      if (noteToEdit) {
        handleEdit(noteToEdit);
        // Clear the URL param
        window.history.replaceState({}, '', '/dashboard/notes');
      }
    }
  }, [notes]);

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes_standalone')
      .select(`
        *,
        projects(name),
        contacts(first_name, last_name),
        employees(first_name, last_name),
        events(title)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setNotes(data);
  };

  const fetchOptions = async () => {
    const [projectsRes, contactsRes, employeesRes, eventsRes] = await Promise.all([
      supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
      supabase.from('contacts').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
      supabase.from('employees').select('id, first_name, last_name').order('first_name'),
      supabase.from('events').select('id, title').order('event_date', { ascending: false }).limit(50)
    ]);
    
    if (projectsRes.data) setProjects(projectsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (employeesRes.data) setEmployees(employeesRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (editingNote) {
      // Update existing note
      await supabase
        .from('notes_standalone')
        .update({
          content,
          project_id: projectId || null,
          contact_id: contactId || null,
          employee_id: employeeId || null,
          event_id: eventId || null,
        })
        .eq('id', editingNote.id);
      
      setEditingNote(null);
    } else {
      // Create new note
      await supabase.from('notes_standalone').insert({
        content,
        project_id: projectId || null,
        contact_id: contactId || null,
        employee_id: employeeId || null,
        event_id: eventId || null,
        created_by: user?.id
      });
    }
    
    setContent('');
    setProjectId('');
    setContactId('');
    setEmployeeId('');
    setEventId('');
    setSaving(false);
    fetchNotes();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    setContent(note.content);
    setProjectId(note.project_id || '');
    setContactId(note.contact_id || '');
    setEmployeeId(note.employee_id || '');
    setEventId(note.event_id || '');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setContent('');
    setProjectId('');
    setContactId('');
    setEmployeeId('');
    setEventId('');
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    
    await supabase
      .from('notes_standalone')
      .delete()
      .eq('id', noteId);
    
    fetchNotes();
  };

  const openTaskModal = (note: any) => {
    setSelectedNote(note);
    setModalOpen(true);
  };

  const handleTaskCreated = async (taskId: string) => {
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {editingNote ? 'Edit Note' : 'Quick Note Entry'}
          </h3>
          {editingNote && (
            <button
              onClick={handleCancelEdit}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border rounded px-3 py-2 min-h-[120px] mb-4"
          placeholder="Type your note here... (Press Enter to save, Shift+Enter for new line)"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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

          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Link to Employee (optional)</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name}
              </option>
            ))}
          </select>

          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Link to Event (optional)</option>
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>{evt.title}</option>
            ))}
          </select>
          
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : editingNote ? 'Update Note' : 'Save Note'}
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
            <div 
              key={note.id} 
              className="bg-white p-4 rounded-lg border hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => handleEdit(note)}
            >
              <p className="text-gray-800 mb-2">{note.content}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
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
                  {note.employees && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      👔 {note.employees.first_name} {note.employees.last_name}
                    </span>
                  )}
                  {note.events && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                      📅 {note.events.title}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(note)}
                    className="text-gray-600 hover:text-blue-600 text-sm font-medium flex items-center gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => openTaskModal(note)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    → Task
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
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

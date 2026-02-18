'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface MeetingNoteFormProps {
  onSave: () => void;
}

export default function MeetingNoteForm({ onSave }: MeetingNoteFormProps) {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contactId, setContactId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Attendees
  const [attendees, setAttendees] = useState<Array<{id: string; name: string; type: 'contact' | 'employee'}>>([]);
  const [attendeeType, setAttendeeType] = useState<'contact' | 'employee'>('contact');
  const [selectedAttendee, setSelectedAttendee] = useState('');
  
  // Discussion Points
  const [discussionPoints, setDiscussionPoints] = useState<Array<{id: string; content: string}>>([]);
  const [discussionInput, setDiscussionInput] = useState('');
  
  // Action Items
  const [actionItems, setActionItems] = useState<Array<{id: string; content: string}>>([]);
  const [actionInput, setActionInput] = useState('');
  
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchOptions = async () => {
      const [projectsRes, contactsRes, employeesRes] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('contacts').select('id, first_name, last_name').order('first_name'),
        supabase.from('employees').select('id, first_name, last_name').order('first_name')
      ]);
      
      if (projectsRes.data) setProjects(projectsRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
    };
    
    fetchOptions();
  }, []);

  const addAttendee = () => {
    if (!selectedAttendee) return;
    
    const list = attendeeType === 'contact' ? contacts : employees;
    const person = list.find(p => p.id === selectedAttendee);
    if (!person) return;
    
    const name = `${person.first_name} ${person.last_name}`;
    setAttendees([...attendees, { id: selectedAttendee, name, type: attendeeType }]);
    setSelectedAttendee('');
  };

  const removeAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const addDiscussionPoint = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && discussionInput.trim()) {
    e.preventDefault(); // ADD THIS LINE
    setDiscussionPoints([...discussionPoints, { id: Date.now().toString(), content: discussionInput }]);
    setDiscussionInput('');
  }
};

  const removeDiscussionPoint = (index: number) => {
    setDiscussionPoints(discussionPoints.filter((_, i) => i !== index));
  };

  const addActionItem = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && actionInput.trim()) {
    e.preventDefault(); // ADD THIS LINE
    setActionItems([...actionItems, { id: Date.now().toString(), content: actionInput }]);
    setActionInput('');
  }
};

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !meetingDate) return;
    
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Create meeting note
    const { data: meetingNote, error: meetingError } = await supabase
      .from('meeting_notes')
      .insert({
        title,
        meeting_date: meetingDate,
        project_id: projectId || null,
        contact_id: contactId || null,
        employee_id: employeeId || null,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (meetingError || !meetingNote) {
      setSaving(false);
      return;
    }
    
    // Save attendees
    if (attendees.length > 0) {
      const attendeeRecords = attendees.map(a => ({
        meeting_note_id: meetingNote.id,
        contact_id: a.type === 'contact' ? a.id : null,
        employee_id: a.type === 'employee' ? a.id : null
      }));
      await supabase.from('meeting_attendees').insert(attendeeRecords);
    }
    
    // Save discussion points
    if (discussionPoints.length > 0) {
      const dpRecords = discussionPoints.map((dp, index) => ({
        meeting_note_id: meetingNote.id,
        content: dp.content,
        sort_order: index
      }));
      await supabase.from('discussion_points').insert(dpRecords);
    }
    
    // Save action items
    if (actionItems.length > 0) {
      const aiRecords = actionItems.map((ai, index) => ({
        meeting_note_id: meetingNote.id,
        content: ai.content,
        sort_order: index
      }));
      await supabase.from('action_items').insert(aiRecords);
    }
    
    // Reset form
    setTitle('');
    setMeetingDate('');
    setProjectId('');
    setContactId('');
    setEmployeeId('');
    setAttendees([]);
    setDiscussionPoints([]);
    setActionItems([]);
    onSave();
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border space-y-6">
      <h3 className="text-lg font-semibold">New Meeting Note</h3>
      
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., Client Strategy Meeting"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Meeting Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Link to Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link to Contact</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link to Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">No employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Attendees Section */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Attendees</h4>
        <div className="flex gap-2 mb-3">
          <select
            value={attendeeType}
            onChange={(e) => setAttendeeType(e.target.value as 'contact' | 'employee')}
            className="border rounded px-3 py-2"
          >
            <option value="contact">Contact</option>
            <option value="employee">Employee</option>
          </select>
          <select
            value={selectedAttendee}
            onChange={(e) => setSelectedAttendee(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          >
            <option value="">Select {attendeeType}...</option>
            {(attendeeType === 'contact' ? contacts : employees).map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addAttendee}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {attendees.map((a, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <span>
                {a.name} <span className="text-xs text-gray-500">({a.type})</span>
              </span>
              <button
                type="button"
                onClick={() => removeAttendee(i)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Discussion Points Section */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Discussion Points</h4>
        <input
          type="text"
          value={discussionInput}
          onChange={(e) => setDiscussionInput(e.target.value)}
          onKeyDown={addDiscussionPoint}
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="Type discussion point and press Enter..."
        />
        <div className="space-y-2">
          {discussionPoints.map((dp, i) => (
            <div key={dp.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <span>• {dp.content}</span>
              <button
                type="button"
                onClick={() => removeDiscussionPoint(i)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items Section */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Action Items</h4>
        <input
          type="text"
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          onKeyDown={addActionItem}
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="Type action item and press Enter..."
        />
        <div className="space-y-2">
          {actionItems.map((ai, i) => (
            <div key={ai.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <span>• {ai.content}</span>
              <button
                type="button"
                onClick={() => removeActionItem(i)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || !title || !meetingDate}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {saving ? 'Saving...' : 'Save Meeting Note'}
      </button>
    </form>
  );
}
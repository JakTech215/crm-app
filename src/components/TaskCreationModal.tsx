'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskId: string) => void;
  defaultTitle: string;
  defaultDescription: string;
  defaultProjectId?: string | null;
  defaultContactId?: string | null;
  sourceType: string;
  sourceId: string;
}

export default function TaskCreationModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTitle,
  defaultDescription,
  defaultProjectId,
  defaultContactId,
  sourceType,
  sourceId
}: TaskCreationModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [contactId, setContactId] = useState(defaultContactId || '');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('pending');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (isOpen) {
      // Set defaults
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setProjectId(defaultProjectId || '');
      setContactId(defaultContactId || '');
      
      // Leave dates empty - user will fill them in
      setStartDate('');
      setDueDate('');
      
      // Fetch options
      fetchOptions();
    }
  }, [isOpen, defaultTitle, defaultDescription, defaultProjectId, defaultContactId]);

  const fetchOptions = async () => {
    const [projectsRes, contactsRes, employeesRes] = await Promise.all([
      supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
      supabase.from('contacts').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
      supabase.from('employees').select('id, first_name, last_name').order('first_name')
    ]);
    
    if (projectsRes.data) setProjects(projectsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (employeesRes.data) setEmployees(employeesRes.data);
  };

  const handleSave = async () => {
    if (!title || !startDate || !dueDate) return;
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Create task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        status,
        priority,
        start_date: startDate,
        due_date: dueDate,
        project_id: projectId || null,
        contact_id: contactId || null,
        source_type: sourceType,
        source_id: sourceId,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (error || !task) {
      console.error('Failed to create task:', error);
      alert('Failed to create task: ' + (error?.message || 'Unknown error'));
      setSaving(false);
      return;
    }
    
    // Assign employees if selected
    if (selectedEmployees.length > 0) {
      const assignments = selectedEmployees.map(empId => ({
        task_id: task.id,
        employee_id: empId,
        assigned_by: user?.id
      }));
      await supabase.from('task_assignees').insert(assignments);
    }
    
    setSaving(false);
    onSuccess(task.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Create Task</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ×
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => {
                  const input = e.currentTarget;
                  if (input.showPicker) {
                    input.showPicker();
                  }
                }}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onClick={(e) => {
                  const input = e.currentTarget;
                  if (input.showPicker) {
                    input.showPicker();
                  }
                }}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
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
              <label className="block text-sm font-medium mb-1">Contact</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Employees</label>
            <select
              value={selectedEmployees[0] || ''}
              onChange={(e) => setSelectedEmployees(e.target.value ? [e.target.value] : [])}
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title || !startDate || !dueDate}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createBrowserClient } from '@supabase/ssr';
import TaskCreationModal from './TaskCreationModal';

interface MeetingNoteCardProps {
  note: any;
  onUpdate: () => void;
}

export default function MeetingNoteCard({ note, onUpdate }: MeetingNoteCardProps) {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [discussionPoints, setDiscussionPoints] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (expanded) {
      fetchDetails();
    }
  }, [expanded]);

  const fetchDetails = async () => {
    // Fetch attendees
    const { data: attendeesData } = await supabase
      .from('meeting_attendees')
      .select(`
        *,
        contacts(first_name, last_name),
        employees(first_name, last_name)
      `)
      .eq('meeting_note_id', note.id);
    
    if (attendeesData) setAttendees(attendeesData);

    // Fetch discussion points with task info
    const { data: dpData } = await supabase
      .from('discussion_points')
      .select(`
        *,
        tasks(id, title)
      `)
      .eq('meeting_note_id', note.id)
      .order('sort_order');
    
    if (dpData) setDiscussionPoints(dpData);

    // Fetch action items with task info
    const { data: aiData } = await supabase
      .from('action_items')
      .select(`
        *,
        tasks(id, title)
      `)
      .eq('meeting_note_id', note.id)
      .order('sort_order');
    
    if (aiData) setActionItems(aiData);
  };

  const openTaskModal = (type: 'discussion' | 'action', item: any) => {
    setModalData({
      type,
      item,
      title: item.content,
      description: `From meeting: ${note.title} on ${formatDate(note.meeting_date)}`,
      projectId: note.project_id,
      contactId: note.contact_id,
    });
    setModalOpen(true);
  };

  const handleTaskCreated = async (taskId: string) => {
    if (!modalData) return;
    
    // Update the source record with the actual task_id
    const table = modalData.type === 'discussion' ? 'discussion_points' : 'action_items';
    await supabase
      .from(table)
      .update({ task_id: taskId })
      .eq('id', modalData.item.id);
    
    // Refresh
    fetchDetails();
    onUpdate();
    setModalData(null);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div 
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{note.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {formatDate(note.meeting_date)}
          </p>
          
          {(note.projects || note.contacts || note.employees) && (
            <div className="mt-2 flex flex-wrap gap-2">
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
            </div>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-600 text-xl font-bold">
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Attendees */}
          {attendees.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Attendees</h4>
              <div className="space-y-1">
                {attendees.map((a, i) => (
                  <div key={i} className="text-sm text-gray-700">
                    • {a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name} (Contact)` : `${a.employees.first_name} ${a.employees.last_name} (Employee)`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discussion Points */}
          {discussionPoints.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Discussion Points</h4>
              <div className="space-y-2">
                {discussionPoints.map((dp) => (
                  <div key={dp.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span>• {dp.content}</span>
                    {dp.task_id && dp.tasks ? (
                      <a 
                        href={`/dashboard/tasks/${dp.tasks.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-600 hover:text-green-800 text-xs flex items-center gap-1"
                      >
                        ✓ Task: {dp.tasks.title}
                      </a>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskModal('discussion', dp);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        → Task
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Action Items</h4>
              <div className="space-y-2">
                {actionItems.map((ai) => (
                  <div key={ai.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span>• {ai.content}</span>
                    {ai.task_id && ai.tasks ? (
                      <a 
                        href={`/dashboard/tasks/${ai.tasks.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-600 hover:text-green-800 text-xs flex items-center gap-1"
                      >
                        ✓ Task: {ai.tasks.title}
                      </a>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskModal('action', ai);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        → Task
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Creation Modal */}
      {modalOpen && modalData && (
        <TaskCreationModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={(taskId: string) => handleTaskCreated(taskId)}
          defaultTitle={modalData.title}
          defaultDescription={modalData.description}
          defaultProjectId={modalData.projectId}
          defaultContactId={modalData.contactId}
          sourceType={modalData.type === 'discussion' ? 'discussion_point' : 'action_item'}
          sourceId={modalData.item.id}
        />
      )}
    </div>
  );
}
"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchContact(contactId: string): Promise<any | null> {
  const rows = await sql`SELECT * FROM contacts WHERE id = ${contactId}`;
  return (rows[0] as unknown) || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchNotes(contactId: string): Promise<any[]> {
  const rows = await sql`SELECT * FROM notes WHERE contact_id = ${contactId} ORDER BY created_at DESC`;
  return rows as unknown as any[];
}

export async function fetchContactTasks(contactId: string) {
  const tasks = await sql`
    SELECT id, title, status, priority, start_date, due_date
    FROM tasks
    WHERE contact_id = ${contactId}
    ORDER BY due_date ASC
  `;

  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);

  // Fetch assignees
  const assignees = await sql`
    SELECT ta.task_id, ta.employee_id, e.first_name, e.last_name
    FROM task_assignees ta
    JOIN employees e ON ta.employee_id = e.id
    WHERE ta.task_id = ANY(${taskIds})
  `;

  const assigneeMap: Record<string, { employee_id: string; employees: { first_name: string; last_name: string } }[]> = {};
  for (const a of assignees) {
    if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
    assigneeMap[a.task_id].push({
      employee_id: a.employee_id,
      employees: { first_name: a.first_name, last_name: a.last_name },
    });
  }

  // Fetch project links
  const projectLinks = await sql`
    SELECT pt.task_id, pt.project_id
    FROM project_tasks pt
    WHERE pt.task_id = ANY(${taskIds})
  `;

  const projectNameMap: Record<string, string> = {};
  if (projectLinks.length > 0) {
    const projectIds = [...new Set(projectLinks.map((pl) => pl.project_id))];
    const projects = await sql`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`;
    for (const p of projects) projectNameMap[p.id] = p.name;
  }

  const taskProjectMap: Record<string, { id: string; name: string }[]> = {};
  for (const pl of projectLinks) {
    const name = projectNameMap[pl.project_id];
    if (name) {
      if (!taskProjectMap[pl.task_id]) taskProjectMap[pl.task_id] = [];
      taskProjectMap[pl.task_id].push({ id: pl.project_id, name });
    }
  }

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    start_date: t.start_date,
    due_date: t.due_date,
    task_assignees: assigneeMap[t.id] || [],
    projects: taskProjectMap[t.id] || [],
  }));
}

export async function fetchAllNonCompletedTasks(): Promise<{ id: string; title: string }[]> {
  const rows = await sql`SELECT id, title FROM tasks WHERE status != 'completed' ORDER BY title`;
  return rows as unknown as { id: string; title: string }[];
}

export async function fetchContactEvents(contactId: string) {
  const events = await sql`
    SELECT e.*, p.id as project_id_ref, p.name as project_name
    FROM events e
    LEFT JOIN projects p ON e.project_id = p.id
    WHERE e.contact_id = ${contactId}
    ORDER BY e.event_date DESC
  `;

  const eventIds = events.map((e) => e.id);
  const attendeeMap: Record<string, { id: string; first_name: string; last_name: string }[]> = {};
  if (eventIds.length > 0) {
    const attData = await sql`
      SELECT ea.event_id, emp.id, emp.first_name, emp.last_name
      FROM event_attendees ea
      JOIN employees emp ON ea.employee_id = emp.id
      WHERE ea.event_id = ANY(${eventIds})
    `;
    for (const a of attData) {
      if (!attendeeMap[a.event_id]) attendeeMap[a.event_id] = [];
      attendeeMap[a.event_id].push({ id: a.id, first_name: a.first_name, last_name: a.last_name });
    }
  }

  const enrichedEvents = events.map((e) => ({
    ...e,
    projects: e.project_id_ref ? { id: e.project_id_ref, name: e.project_name } : null,
  }));

  return { events: enrichedEvents, attendeeMap };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchStandaloneNotes(contactId: string): Promise<any[]> {
  const rows = await sql`SELECT * FROM notes_standalone WHERE contact_id = ${contactId} ORDER BY created_at DESC`;
  return rows as unknown as any[];
}

export async function updateEventStatus(eventId: string, newStatus: string) {
  await sql`UPDATE events SET status = ${newStatus} WHERE id = ${eventId}`;
}

export async function addStandaloneNote(contactId: string, content: string) {
  const user = await getSessionUser();
  await sql`INSERT INTO notes_standalone (contact_id, content, author_id) VALUES (${contactId}, ${content}, ${user?.id})`;
}

export async function deleteStandaloneNote(noteId: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${noteId}`;
}

export async function linkTaskToContact(taskId: string, contactId: string) {
  await sql`UPDATE tasks SET contact_id = ${contactId} WHERE id = ${taskId}`;
}

export async function unlinkTaskFromContact(taskId: string) {
  await sql`UPDATE tasks SET contact_id = NULL WHERE id = ${taskId}`;
}

export async function updateTaskField(taskId: string, field: string, value: string) {
  await sql`UPDATE tasks SET ${sql({ [field]: value })} WHERE id = ${taskId}`;
}

export async function fetchContactStatuses(): Promise<{ id: string; name: string; color: string }[]> {
  const rows = await sql`SELECT id, name, color FROM contact_statuses ORDER BY name`;
  return rows as unknown as { id: string; name: string; color: string }[];
}

export async function saveNote(noteId: string | null, contactId: string, content: string, noteType: string, updatedAt?: string) {
  if (noteId) {
    // Update existing note
    await sql`UPDATE notes SET content = ${content}, note_type = ${noteType}, updated_at = ${updatedAt || new Date().toISOString()} WHERE id = ${noteId}`;
  } else {
    // Insert new note
    const user = await getSessionUser();
    await sql`INSERT INTO notes (contact_id, content, note_type, author_id) VALUES (${contactId}, ${content}, ${noteType}, ${user?.id})`;
  }
}

export async function deleteNote(noteId: string) {
  await sql`DELETE FROM notes WHERE id = ${noteId}`;
}

export async function updateContact(
  contactId: string,
  form: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    status: string;
    email_notifications_enabled: boolean;
    sms_notifications_enabled: boolean;
  }
) {
  const data = {
    first_name: form.first_name,
    last_name: form.last_name || null,
    email: form.email || null,
    phone: form.phone || null,
    company: form.company || null,
    status: form.status || "active",
    email_notifications_enabled: form.email_notifications_enabled,
    sms_notifications_enabled: form.sms_notifications_enabled,
  };
  await sql`UPDATE contacts SET ${sql(data)} WHERE id = ${contactId}`;
}

export async function checkContactDependencies(contactId: string): Promise<{ projects: { id: string; name: string }[]; tasks: { id: string; title: string }[] }> {
  const [projects, tasks] = await Promise.all([
    sql`SELECT id, name FROM projects WHERE contact_id = ${contactId}`,
    sql`SELECT id, title FROM tasks WHERE contact_id = ${contactId}`,
  ]);
  return {
    projects: projects as unknown as { id: string; name: string }[],
    tasks: tasks as unknown as { id: string; title: string }[],
  };
}

export async function deleteContact(contactId: string) {
  await Promise.all([
    sql`UPDATE projects SET contact_id = NULL WHERE contact_id = ${contactId}`,
    sql`UPDATE tasks SET contact_id = NULL WHERE contact_id = ${contactId}`,
    sql`DELETE FROM notes WHERE contact_id = ${contactId}`,
  ]);
  await sql`DELETE FROM contacts WHERE id = ${contactId}`;
}

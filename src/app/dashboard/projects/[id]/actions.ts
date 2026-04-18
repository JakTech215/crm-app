"use server";

import sql from "@/lib/db";
import { currentUserId } from "@/lib/visibility";

export async function fetchProject(projectId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const rows = await sql`
    SELECT p.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM projects p
    LEFT JOIN contacts c ON p.contact_id = c.id
    WHERE p.id = ${projectId} AND ${vis}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    contacts: r.contact_id
      ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name }
      : null,
  };
}

export async function fetchProjectTasks(projectId: string) {
  const userId = await currentUserId();
  const taskVis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;

  const links = await sql`SELECT task_id FROM project_tasks WHERE project_id = ${projectId}`;
  if (links.length === 0) return { tasks: [], taskProjectMap: {} };

  const taskIds = links.map((l) => l.task_id);

  const tasks = await sql`
    SELECT t.id, t.title, t.priority, t.status, t.due_date, t.start_date, t.is_milestone, t.is_private, t.contact_id,
           c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.id = ANY(${taskIds}) AND ${taskVis}
    ORDER BY t.due_date ASC
  `;

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

  const enriched = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
    start_date: t.start_date,
    is_milestone: t.is_milestone,
    is_private: t.is_private,
    contact_id: t.contact_id,
    contacts: t.contact_id
      ? { first_name: t.contact_first_name, last_name: t.contact_last_name }
      : null,
    task_assignees: assigneeMap[t.id] || [],
  }));

  // Fetch other project links for these tasks (excluding current project,
  // and limited to projects the user can see).
  const projVis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const allPtLinks = await sql`
    SELECT pt.task_id, pt.project_id
    FROM project_tasks pt
    JOIN projects p ON p.id = pt.project_id
    WHERE pt.task_id = ANY(${taskIds}) AND pt.project_id != ${projectId} AND ${projVis}
  `;

  const taskProjectMap: Record<string, { id: string; name: string }[]> = {};
  if (allPtLinks.length > 0) {
    const otherProjectIds = [...new Set(allPtLinks.map((pt) => pt.project_id))];
    const projData = await sql`SELECT id, name FROM projects WHERE id = ANY(${otherProjectIds})`;
    const projNameMap: Record<string, string> = {};
    for (const p of projData) projNameMap[p.id] = p.name;

    for (const pt of allPtLinks) {
      const name = projNameMap[pt.project_id];
      if (name) {
        if (!taskProjectMap[pt.task_id]) taskProjectMap[pt.task_id] = [];
        taskProjectMap[pt.task_id].push({ id: pt.project_id, name });
      }
    }
  }

  return { tasks: enriched, taskProjectMap };
}

export async function fetchAllNonCompletedTasks(): Promise<{ id: string; title: string }[]> {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`SELECT t.id, t.title FROM tasks t WHERE t.status != 'completed' AND ${vis} ORDER BY t.title`;
  return rows as unknown as { id: string; title: string }[];
}

export async function linkTaskToProject(taskId: string, projectId: string) {
  await sql`INSERT INTO project_tasks (task_id, project_id) VALUES (${taskId}, ${projectId})`;
}

export async function unlinkTaskFromProject(taskId: string, projectId: string) {
  await sql`DELETE FROM project_tasks WHERE task_id = ${taskId} AND project_id = ${projectId}`;
}

export async function updateTaskField(taskId: string, field: string, value: string) {
  await sql`UPDATE tasks SET ${sql({ [field]: value })} WHERE id = ${taskId}`;
}

export async function fetchContacts(): Promise<{ id: string; first_name: string; last_name: string | null }[]> {
  const rows = await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
  return rows as unknown as { id: string; first_name: string; last_name: string | null }[];
}

export async function fetchActiveEmployees(): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const rows = await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
  return rows as unknown as { id: string; first_name: string; last_name: string }[];
}

export async function fetchProjectEmployeeIds(projectId: string) {
  const rows = await sql`SELECT employee_id FROM project_employees WHERE project_id = ${projectId}`;
  return rows.map((r) => r.employee_id);
}

export async function fetchProjectStatuses(): Promise<{ id: string; name: string; color: string }[]> {
  const rows = await sql`SELECT id, name, color FROM project_statuses ORDER BY name`;
  return rows as unknown as { id: string; name: string; color: string }[];
}

export async function fetchProjectEvents(projectId: string) {
  const events = await sql`
    SELECT e.*, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE e.project_id = ${projectId}
    ORDER BY e.event_date DESC
  `;

  const eventIds = events.map((e) => e.id);
  const attendeeMap: Record<string, { id: string; first_name: string; last_name: string }[]> = {};
  if (eventIds.length > 0) {
    const attData = await sql`
      SELECT ea.event_id, e.id, e.first_name, e.last_name
      FROM event_attendees ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE ea.event_id = ANY(${eventIds})
    `;
    for (const a of attData) {
      if (!attendeeMap[a.event_id]) attendeeMap[a.event_id] = [];
      attendeeMap[a.event_id].push({ id: a.id, first_name: a.first_name, last_name: a.last_name });
    }
  }

  const enrichedEvents = events.map((e) => ({
    ...e,
    contacts: e.contact_id
      ? { first_name: e.contact_first_name, last_name: e.contact_last_name }
      : null,
  }));

  return { events: enrichedEvents, attendeeMap };
}

export async function updateEventStatus(eventId: string, newStatus: string) {
  await sql`UPDATE events SET status = ${newStatus} WHERE id = ${eventId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchProjectNotes(projectId: string): Promise<any[]> {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(n.is_private = false OR n.created_by = ${userId})`
    : sql`n.is_private = false`;
  const rows = await sql`SELECT n.* FROM notes_standalone n WHERE n.project_id = ${projectId} AND ${vis} ORDER BY n.created_at DESC`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows as unknown as any[];
}

export async function addProjectNote(projectId: string, content: string) {
  await sql`INSERT INTO notes_standalone (content, project_id) VALUES (${content}, ${projectId})`;
}

export async function deleteProjectNote(noteId: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${noteId}`;
}

export async function updateProject(
  projectId: string,
  form: {
    name: string;
    description: string;
    contact_id: string;
    status: string;
    start_date: string;
    due_date: string;
    is_private?: boolean;
  },
  selectedEmployees: string[]
) {
  const data = {
    name: form.name,
    description: form.description || null,
    contact_id: form.contact_id || null,
    status: form.status,
    start_date: form.start_date || null,
    due_date: form.due_date || null,
    is_private: form.is_private ?? false,
  };

  await sql`UPDATE projects SET ${sql(data)} WHERE id = ${projectId}`;

  // Update employee associations
  await sql`DELETE FROM project_employees WHERE project_id = ${projectId}`;
  if (selectedEmployees.length > 0) {
    const links = selectedEmployees.map((eid) => ({
      project_id: projectId,
      employee_id: eid,
    }));
    await sql`INSERT INTO project_employees ${sql(links)}`;
  }
}

export async function deleteProject(projectId: string) {
  await sql`DELETE FROM project_tasks WHERE project_id = ${projectId}`;
  await sql`DELETE FROM projects WHERE id = ${projectId}`;
}

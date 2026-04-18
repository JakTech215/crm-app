"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { currentUserId } from "@/lib/visibility";

// ─── Google Calendar Settings ───────────────────────────────────────────────

export async function checkGoogleCalendarConnection() {
  const user = await getSessionUser();
  if (!user) return { connected: false };

  const rows = await sql`
    SELECT id FROM google_calendar_tokens WHERE user_id = ${user.id} LIMIT 1
  `;
  return { connected: rows.length > 0 };
}

// ─── Quick Capture / Notes Standalone ───────────────────────────────────────

export async function fetchStandaloneNotes() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(n.is_private = false OR n.created_by = ${userId})`
    : sql`n.is_private = false`;
  const rows = await sql`
    SELECT
      n.*,
      row_to_json(p) AS projects,
      row_to_json(c) AS contacts,
      row_to_json(e) AS employees,
      row_to_json(ev) AS events
    FROM notes_standalone n
    LEFT JOIN projects p ON p.id = n.project_id
    LEFT JOIN contacts c ON c.id = n.contact_id
    LEFT JOIN employees e ON e.id = n.employee_id
    LEFT JOIN events ev ON ev.id = n.event_id
    WHERE ${vis}
    ORDER BY n.created_at DESC
  `;
  return rows.map((r: any) => ({
    ...r,
    projects: r.projects?.id ? { name: r.projects.name } : null,
    contacts: r.contacts?.id
      ? { first_name: r.contacts.first_name, last_name: r.contacts.last_name }
      : null,
    employees: r.employees?.id
      ? { first_name: r.employees.first_name, last_name: r.employees.last_name }
      : null,
    events: r.events?.id ? { title: r.events.title } : null,
  }));
}

export async function createStandaloneNote(data: {
  content: string;
  project_id: string | null;
  contact_id: string | null;
  employee_id: string | null;
  event_id: string | null;
  is_private?: boolean;
}) {
  const user = await getSessionUser();
  const row = { ...data, is_private: data.is_private ?? false, created_by: user?.id ?? null };
  await sql`INSERT INTO notes_standalone ${sql(row)}`;
}

export async function updateStandaloneNote(
  id: string,
  data: {
    content: string;
    project_id: string | null;
    contact_id: string | null;
    employee_id: string | null;
    event_id: string | null;
    is_private?: boolean;
  }
) {
  const row = { ...data, is_private: data.is_private ?? false };
  await sql`UPDATE notes_standalone SET ${sql(row)} WHERE id = ${id}`;
}

export async function deleteStandaloneNote(id: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${id}`;
}

// ─── Shared option lists (projects, contacts, employees, events) ────────────

export async function fetchProjectOptions() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  return await sql`SELECT p.id, p.name FROM projects p WHERE p.status = 'active' AND ${vis} ORDER BY p.name`;
}

export async function fetchAllProjectOptions() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  return await sql`SELECT p.id, p.name FROM projects p WHERE ${vis} ORDER BY p.name`;
}

export async function fetchContactOptions() {
  return await sql`SELECT id, first_name, last_name FROM contacts WHERE status = 'active' ORDER BY first_name`;
}

export async function fetchAllContactOptions() {
  return await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
}

export async function fetchEmployeeOptions() {
  return await sql`SELECT id, first_name, last_name FROM employees ORDER BY first_name`;
}

export async function fetchEventOptions() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(e.is_private = false OR e.created_by = ${userId})`
    : sql`e.is_private = false`;
  return await sql`SELECT e.id, e.title FROM events e WHERE ${vis} ORDER BY e.event_date DESC LIMIT 50`;
}

// ─── Meeting Notes ──────────────────────────────────────────────────────────

export async function fetchMeetingNotes() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(mn.is_private = false OR mn.created_by = ${userId})`
    : sql`mn.is_private = false`;
  const rows = await sql`
    SELECT
      mn.*,
      row_to_json(p) AS projects,
      row_to_json(c) AS contacts,
      row_to_json(e) AS employees,
      row_to_json(ev) AS events
    FROM meeting_notes mn
    LEFT JOIN projects p ON p.id = mn.project_id
    LEFT JOIN contacts c ON c.id = mn.contact_id
    LEFT JOIN employees e ON e.id = mn.employee_id
    LEFT JOIN events ev ON ev.id = mn.event_id
    WHERE ${vis}
    ORDER BY mn.meeting_date DESC
  `;
  return rows.map((r: any) => ({
    ...r,
    projects: r.projects?.id ? { name: r.projects.name } : null,
    contacts: r.contacts?.id
      ? { first_name: r.contacts.first_name, last_name: r.contacts.last_name }
      : null,
    employees: r.employees?.id
      ? { first_name: r.employees.first_name, last_name: r.employees.last_name }
      : null,
    events: r.events?.id ? { title: r.events.title } : null,
  }));
}

export async function createMeetingNote(data: {
  title: string;
  meeting_date: string;
  project_id: string | null;
  contact_id: string | null;
  employee_id: string | null;
  event_id: string | null;
  is_private?: boolean;
  attendees: Array<{ contact_id: string | null; employee_id: string | null }>;
  discussion_points: Array<{ content: string; sort_order: number }>;
  action_items: Array<{ content: string; sort_order: number }>;
}) {
  const user = await getSessionUser();

  const rows = await sql`
    INSERT INTO meeting_notes ${sql({
      title: data.title,
      meeting_date: data.meeting_date,
      project_id: data.project_id,
      contact_id: data.contact_id,
      employee_id: data.employee_id,
      event_id: data.event_id,
      is_private: data.is_private ?? false,
      created_by: user?.id ?? null,
    })} RETURNING *
  `;
  const meetingNote = rows[0];

  if (data.attendees.length > 0) {
    const attendeeRecords = data.attendees.map((a) => ({
      meeting_note_id: meetingNote.id,
      contact_id: a.contact_id,
      employee_id: a.employee_id,
    }));
    for (const rec of attendeeRecords) {
      await sql`INSERT INTO meeting_attendees ${sql(rec)}`;
    }
  }

  if (data.discussion_points.length > 0) {
    for (const dp of data.discussion_points) {
      await sql`INSERT INTO discussion_points ${sql({
        meeting_note_id: meetingNote.id,
        content: dp.content,
        sort_order: dp.sort_order,
      })}`;
    }
  }

  if (data.action_items.length > 0) {
    for (const ai of data.action_items) {
      await sql`INSERT INTO action_items ${sql({
        meeting_note_id: meetingNote.id,
        content: ai.content,
        sort_order: ai.sort_order,
      })}`;
    }
  }

  return meetingNote;
}

export async function updateMeetingNote(
  id: string,
  data: {
    title: string;
    meeting_date: string;
    project_id: string | null;
    contact_id: string | null;
    employee_id: string | null;
    event_id: string | null;
    is_private?: boolean;
  }
) {
  const row = { ...data, is_private: data.is_private ?? false };
  await sql`UPDATE meeting_notes SET ${sql(row)} WHERE id = ${id}`;
}

// ─── Meeting Note Card (details, link task) ─────────────────────────────────

export async function fetchMeetingNoteDetails(meetingNoteId: string) {
  const attendees = await sql`
    SELECT
      ma.*,
      row_to_json(c) AS contacts,
      row_to_json(e) AS employees
    FROM meeting_attendees ma
    LEFT JOIN contacts c ON c.id = ma.contact_id
    LEFT JOIN employees e ON e.id = ma.employee_id
    WHERE ma.meeting_note_id = ${meetingNoteId}
  `;

  const discussionPoints = await sql`
    SELECT
      dp.*,
      row_to_json(t) AS tasks
    FROM discussion_points dp
    LEFT JOIN tasks t ON t.id = dp.task_id
    WHERE dp.meeting_note_id = ${meetingNoteId}
    ORDER BY dp.sort_order
  `;

  const actionItems = await sql`
    SELECT
      ai.*,
      row_to_json(t) AS tasks
    FROM action_items ai
    LEFT JOIN tasks t ON t.id = ai.task_id
    WHERE ai.meeting_note_id = ${meetingNoteId}
    ORDER BY ai.sort_order
  `;

  const clean = (rows: any[], nestedKeys: string[]) =>
    rows.map((r: any) => {
      const out = { ...r };
      for (const k of nestedKeys) {
        out[k] = r[k]?.id ? r[k] : null;
      }
      return out;
    });

  return {
    attendees: clean(attendees, ["contacts", "employees"]).map((a: any) => ({
      ...a,
      contacts: a.contacts
        ? { first_name: a.contacts.first_name, last_name: a.contacts.last_name }
        : null,
      employees: a.employees
        ? { first_name: a.employees.first_name, last_name: a.employees.last_name }
        : null,
    })),
    discussionPoints: clean(discussionPoints, ["tasks"]).map((dp: any) => ({
      ...dp,
      tasks: dp.tasks ? { id: dp.tasks.id, title: dp.tasks.title } : null,
    })),
    actionItems: clean(actionItems, ["tasks"]).map((ai: any) => ({
      ...ai,
      tasks: ai.tasks ? { id: ai.tasks.id, title: ai.tasks.title } : null,
    })),
  };
}

export async function linkItemToTask(
  table: "discussion_points" | "action_items",
  itemId: string,
  taskId: string
) {
  if (table === "discussion_points") {
    await sql`UPDATE discussion_points SET task_id = ${taskId} WHERE id = ${itemId}`;
  } else {
    await sql`UPDATE action_items SET task_id = ${taskId} WHERE id = ${itemId}`;
  }
}

// ─── Task Creation Modal ────────────────────────────────────────────────────

export async function createTask(data: {
  title: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  project_id: string | null;
  contact_id: string | null;
  source_type: string;
  source_id: string;
  employee_ids: string[];
}) {
  const user = await getSessionUser();

  const { employee_ids, ...taskData } = data;
  const rows = await sql`
    INSERT INTO tasks ${sql({
      ...taskData,
      created_by: user?.id ?? null,
    })} RETURNING *
  `;
  const task = rows[0];

  if (employee_ids.length > 0) {
    for (const empId of employee_ids) {
      await sql`INSERT INTO task_assignees ${sql({
        task_id: task.id,
        employee_id: empId,
        assigned_by: user?.id ?? null,
      })}`;
    }
  }

  return task;
}

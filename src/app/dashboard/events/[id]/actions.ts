"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function fetchEvent(eventId: string) {
  const rows = await sql`
    SELECT e.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE e.id = ${eventId}
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

export async function fetchAttendees(eventId: string) {
  const rows = await sql`
    SELECT ea.id, ea.event_id, ea.employee_id, ea.attendance_status,
           e.id as emp_id, e.first_name, e.last_name
    FROM event_attendees ea
    JOIN employees e ON ea.employee_id = e.id
    WHERE ea.event_id = ${eventId}
  `;
  return rows.map((r) => ({
    id: r.id,
    event_id: r.event_id,
    employee_id: r.employee_id,
    attendance_status: r.attendance_status,
    employees: { id: r.emp_id, first_name: r.first_name, last_name: r.last_name },
  }));
}

export async function fetchNotes(eventId: string) {
  return await sql`
    SELECT * FROM notes_standalone
    WHERE event_id = ${eventId}
    ORDER BY created_at DESC
  `;
}

export async function fetchProjectName(projectId: string) {
  const rows = await sql`SELECT name FROM projects WHERE id = ${projectId}`;
  return rows[0]?.name || null;
}

export async function fetchActiveEmployees() {
  return await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
}

export async function fetchAllProjects() {
  return await sql`SELECT id, name FROM projects ORDER BY name`;
}

export async function fetchAllContacts() {
  return await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
}

export async function updateEventStatus(eventId: string, status: string) {
  await sql`UPDATE events SET status = ${status} WHERE id = ${eventId}`;
}

export async function addAttendee(eventId: string, employeeId: string) {
  await sql`INSERT INTO event_attendees ${sql({ event_id: eventId, employee_id: employeeId, attendance_status: "invited" })}`;
}

export async function removeAttendee(attendeeId: string) {
  await sql`DELETE FROM event_attendees WHERE id = ${attendeeId}`;
}

export async function addNote(eventId: string, content: string) {
  const user = await getSessionUser();
  await sql`INSERT INTO notes_standalone ${sql({
    content,
    event_id: eventId,
    created_by: user?.id || null,
  })}`;
}

export async function deleteNote(noteId: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${noteId}`;
}

export async function updateEventFull(
  eventId: string,
  payload: {
    title: string;
    description: string | null;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    event_type: string;
    status: string;
    project_id: string | null;
    contact_id: string | null;
  },
  selectedEmployees: string[]
) {
  await sql`UPDATE events SET ${sql(payload)} WHERE id = ${eventId}`;

  // Replace attendees
  await sql`DELETE FROM event_attendees WHERE event_id = ${eventId}`;
  if (selectedEmployees.length > 0) {
    const attendeeRows = selectedEmployees.map((empId) => ({
      event_id: eventId,
      employee_id: empId,
      attendance_status: "invited",
    }));
    await sql`INSERT INTO event_attendees ${sql(attendeeRows)}`;
  }
}

export async function deleteEventFull(eventId: string) {
  await Promise.all([
    sql`DELETE FROM event_attendees WHERE event_id = ${eventId}`,
    sql`DELETE FROM notes_standalone WHERE event_id = ${eventId}`,
  ]);
  await sql`DELETE FROM events WHERE id = ${eventId}`;
}

export async function convertEventToTask(event: {
  title: string;
  description: string | null;
  contact_id: string | null;
  project_id: string | null;
}) {
  const user = await getSessionUser();

  const rows = await sql`INSERT INTO tasks ${sql({
    title: event.title,
    description: event.description || null,
    contact_id: event.contact_id || null,
    status: "pending",
    priority: "medium",
    created_by: user?.id || null,
  })} RETURNING id`;
  const taskId = rows[0].id;

  if (event.project_id) {
    await sql`INSERT INTO project_tasks ${sql({
      task_id: taskId,
      project_id: event.project_id,
    })}`;
  }

  return taskId;
}

"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function fetchEvents() {
  const rows = await sql`
    SELECT e.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    ORDER BY e.event_date DESC
  `;
  return rows.map((r) => ({
    ...r,
    contacts: r.contact_id
      ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name }
      : null,
  })) as any;
}

export async function fetchEventAttendees(eventIds: string[]) {
  if (eventIds.length === 0) return {};
  const rows = await sql`
    SELECT ea.event_id, ea.employee_id, e.id, e.first_name, e.last_name
    FROM event_attendees ea
    JOIN employees e ON ea.employee_id = e.id
    WHERE ea.event_id = ANY(${eventIds})
  `;
  const map: Record<string, { employee_id: string; employees: { id: string; first_name: string; last_name: string } }[]> = {};
  for (const r of rows) {
    if (!map[r.event_id]) map[r.event_id] = [];
    map[r.event_id].push({
      employee_id: r.employee_id,
      employees: { id: r.id, first_name: r.first_name, last_name: r.last_name },
    });
  }
  return map;
}

export async function fetchActiveEmployees() {
  const rows = await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
  return [...rows] as any;
}

export async function fetchProjects() {
  const rows = await sql`SELECT id, name FROM projects ORDER BY name`;
  return [...rows] as any;
}

export async function fetchContacts() {
  const rows = await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
  return [...rows] as any;
}

export async function updateEventStatus(eventId: string, status: string) {
  await sql`UPDATE events SET status = ${status}, updated_at = NOW() WHERE id = ${eventId}`;
}

export async function createEvent(
  payload: {
    title: string;
    description: string | null;
    event_date: string;
    event_time: string | null;
    location: string | null;
    event_type: string;
    status: string;
    project_id: string | null;
    contact_id: string | null;
  },
  selectedEmployees: string[]
) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be logged in.");

  const dataObj = { ...payload, created_by: user.id };
  const rows = await sql`INSERT INTO events ${sql(dataObj)} RETURNING *`;
  const newEvent = rows[0];

  if (selectedEmployees.length > 0) {
    const attendeeRows = selectedEmployees.map((empId) => ({
      event_id: newEvent.id,
      employee_id: empId,
    }));
    await sql`INSERT INTO event_attendees ${sql(attendeeRows)}`;
  }

  return newEvent ? { ...newEvent } as any : null;
}

export async function updateEvent(
  eventId: string,
  payload: {
    title: string;
    description: string | null;
    event_date: string;
    event_time: string | null;
    location: string | null;
    event_type: string;
    status: string;
    project_id: string | null;
    contact_id: string | null;
  },
  selectedEmployees: string[]
) {
  const dataObj = { ...payload, updated_at: new Date().toISOString() };
  await sql`UPDATE events SET ${sql(dataObj)} WHERE id = ${eventId}`;

  // Replace attendees
  await sql`DELETE FROM event_attendees WHERE event_id = ${eventId}`;
  if (selectedEmployees.length > 0) {
    const attendeeRows = selectedEmployees.map((empId) => ({
      event_id: eventId,
      employee_id: empId,
    }));
    await sql`INSERT INTO event_attendees ${sql(attendeeRows)}`;
  }
}

export async function deleteEvent(eventId: string) {
  await sql`DELETE FROM event_attendees WHERE event_id = ${eventId}`;
  await sql`DELETE FROM events WHERE id = ${eventId}`;
}

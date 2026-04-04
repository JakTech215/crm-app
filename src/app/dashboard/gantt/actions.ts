"use server";

import sql from "@/lib/db";

export async function fetchGanttData() {
  const [taskData, depData, projData, ptLinks, assigneeData, empData] = await Promise.all([
    sql`SELECT t.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
        FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id ORDER BY t.start_date`,
    sql`SELECT task_id, depends_on_task_id, dependency_type, lag_days FROM task_dependencies`,
    sql`SELECT id, name FROM projects ORDER BY name`,
    sql`SELECT task_id, project_id FROM project_tasks`,
    sql`SELECT task_id, employee_id FROM task_assignees`,
    sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`,
  ]);

  return { taskData, depData, projData, ptLinks, assigneeData, empData };
}

export async function fetchGanttEvents() {
  const eventData = await sql`
    SELECT e.id, e.title, e.event_date, e.event_type, e.status, e.project_id, e.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    ORDER BY e.event_date
  `;
  return eventData;
}

export async function fetchGanttEventAttendees(eventIds: string[]) {
  if (eventIds.length === 0) return {};
  const rows = await sql`
    SELECT event_id, employee_id FROM event_attendees WHERE event_id = ANY(${eventIds})
  `;
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.event_id]) map[r.event_id] = [];
    map[r.event_id].push(r.employee_id);
  }
  return map;
}

export async function fetchCustomHolidays() {
  return await sql`SELECT holiday_date, name FROM holidays`;
}

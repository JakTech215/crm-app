"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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

  return { taskData: [...taskData] as any, depData: [...depData] as any, projData: [...projData] as any, ptLinks: [...ptLinks] as any, assigneeData: [...assigneeData] as any, empData: [...empData] as any };
}

export async function fetchGanttEvents() {
  const eventData = await sql`
    SELECT e.id, e.title, e.event_date, e.event_type, e.status, e.project_id, e.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    ORDER BY e.event_date
  `;
  return [...eventData] as any;
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
  const rows = await sql`SELECT holiday_date, name FROM holidays`;
  return [...rows] as any;
}

// ---- Gantt filter presets ----

export interface GanttFilterPreset {
  id: string;
  name: string;
  filters: Record<string, unknown>;
}

export async function fetchFilterPresets(): Promise<GanttFilterPreset[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await sql`
    SELECT id, name, filters FROM gantt_filter_presets
    WHERE user_id = ${user.id} ORDER BY name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, filters: r.filters as Record<string, unknown> }));
}

export async function saveFilterPreset(name: string, filters: Record<string, unknown>): Promise<GanttFilterPreset> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const rows = await sql`
    INSERT INTO gantt_filter_presets (user_id, name, filters)
    VALUES (${user.id}, ${name}, ${JSON.stringify(filters)})
    RETURNING id, name, filters
  `;
  return { id: rows[0].id, name: rows[0].name, filters: rows[0].filters as Record<string, unknown> };
}

export async function updateFilterPreset(id: string, filters: Record<string, unknown>): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  await sql`
    UPDATE gantt_filter_presets SET filters = ${JSON.stringify(filters)}, updated_at = now()
    WHERE id = ${id} AND user_id = ${user.id}
  `;
}

export async function deleteFilterPreset(id: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  await sql`DELETE FROM gantt_filter_presets WHERE id = ${id} AND user_id = ${user.id}`;
}

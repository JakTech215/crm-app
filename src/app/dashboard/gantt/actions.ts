"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { currentUserId } from "@/lib/visibility";

export async function fetchGanttData() {
  const userId = await currentUserId();
  const taskVis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const projVis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;

  const [taskData, depData, projData, ptLinks, assigneeData, empData] = await Promise.all([
    sql`SELECT t.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
        FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id
        WHERE ${taskVis}
        ORDER BY t.start_date`,
    sql`SELECT task_id, depends_on_task_id, dependency_type, lag_days FROM task_dependencies`,
    sql`SELECT p.id, p.name FROM projects p WHERE ${projVis} ORDER BY p.name`,
    sql`SELECT pt.task_id, pt.project_id
        FROM project_tasks pt
        JOIN projects p ON p.id = pt.project_id
        JOIN tasks t ON t.id = pt.task_id
        WHERE ${projVis} AND ${taskVis}`,
    sql`SELECT task_id, employee_id FROM task_assignees`,
    sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`,
  ]);

  return { taskData: [...taskData] as any, depData: [...depData] as any, projData: [...projData] as any, ptLinks: [...ptLinks] as any, assigneeData: [...assigneeData] as any, empData: [...empData] as any };
}

export async function fetchGanttEvents() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(e.is_private = false OR e.created_by = ${userId})`
    : sql`e.is_private = false`;
  const eventData = await sql`
    SELECT e.id, e.title, e.event_date, e.event_type, e.status, e.project_id, e.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM events e
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE ${vis}
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

function coerceFilters(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

export async function fetchFilterPresets(): Promise<GanttFilterPreset[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await sql`
    SELECT id, name, filters FROM gantt_filter_presets
    WHERE user_id = ${user.id} ORDER BY name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, filters: coerceFilters(r.filters) }));
}

export async function saveFilterPreset(name: string, filters: Record<string, unknown>): Promise<GanttFilterPreset> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const payload = JSON.stringify(filters);
  const rows = await sql`
    INSERT INTO gantt_filter_presets (user_id, name, filters)
    VALUES (${user.id}, ${name}, ${payload}::jsonb)
    RETURNING id, name, filters
  `;
  return { id: rows[0].id, name: rows[0].name, filters: coerceFilters(rows[0].filters) };
}

export async function updateFilterPreset(id: string, filters: Record<string, unknown>): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const payload = JSON.stringify(filters);
  await sql`
    UPDATE gantt_filter_presets SET filters = ${payload}::jsonb, updated_at = now()
    WHERE id = ${id} AND user_id = ${user.id}
  `;
}

export async function deleteFilterPreset(id: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  await sql`DELETE FROM gantt_filter_presets WHERE id = ${id} AND user_id = ${user.id}`;
}

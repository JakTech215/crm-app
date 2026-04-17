"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function fetchProjects() {
  const rows = await sql`
    SELECT p.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM projects p
    LEFT JOIN contacts c ON p.contact_id = c.id
    ORDER BY p.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    contact_id: r.contact_id,
    status: r.status,
    start_date: r.start_date,
    due_date: r.due_date,
    created_at: r.created_at,
    contacts: r.contact_id
      ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name }
      : null,
  }));
}

export async function fetchContacts(): Promise<{ id: string; first_name: string; last_name: string | null }[]> {
  const rows = await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
  return rows as unknown as { id: string; first_name: string; last_name: string | null }[];
}

export async function fetchActiveEmployees(): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const rows = await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
  return rows as unknown as { id: string; first_name: string; last_name: string }[];
}

export async function fetchProjectEmployeesMap() {
  const rows = await sql`
    SELECT pe.project_id, e.id, e.first_name, e.last_name
    FROM project_employees pe
    JOIN employees e ON pe.employee_id = e.id
  `;
  const map: Record<string, { id: string; first_name: string; last_name: string }[]> = {};
  for (const r of rows) {
    if (!map[r.project_id]) map[r.project_id] = [];
    map[r.project_id].push({ id: r.id, first_name: r.first_name, last_name: r.last_name });
  }
  return map;
}

export async function fetchProjectStatuses(): Promise<{ id: string; name: string; color: string }[]> {
  const rows = await sql`SELECT id, name, color FROM project_statuses ORDER BY name`;
  return rows as unknown as { id: string; name: string; color: string }[];
}

export async function fetchProjectTasksMap(today: string) {
  try {
  const links = await sql`SELECT task_id, project_id FROM project_tasks`;
  if (links.length === 0) return {};

  const taskIds = [...new Set(links.map((l) => l.task_id))];

  const tasks = await sql`
    SELECT id, title, due_date FROM tasks
    WHERE id = ANY(${taskIds})
      AND status != 'completed'
      AND status != 'cancelled'
      AND due_date >= ${today}
    ORDER BY due_date ASC
  `;

  const taskById: Record<string, { id: string; title: string; due_date: string | null }> = {};
  for (const t of tasks) taskById[t.id] = { id: t.id, title: t.title, due_date: t.due_date };

  const raw: Record<string, { id: string; title: string; due_date: string | null }[]> = {};
  for (const l of links) {
    const task = taskById[l.task_id];
    if (!task) continue;
    if (!raw[l.project_id]) raw[l.project_id] = [];
    raw[l.project_id].push(task);
  }

  const map: Record<string, { id: string; title: string; due_date: string | null }[]> = {};
  for (const [projId, projTasks] of Object.entries(raw)) {
    map[projId] = projTasks
      .sort((a, b) => {
        const at = a.due_date ? new Date(a.due_date as unknown as string | Date).getTime() : Number.POSITIVE_INFINITY;
        const bt = b.due_date ? new Date(b.due_date as unknown as string | Date).getTime() : Number.POSITIVE_INFINITY;
        return at - bt;
      })
      .slice(0, 3);
  }
  return map;
  } catch (err) {
    console.error("[fetchProjectTasksMap] failed", { today, err });
    throw err;
  }
}

export async function createProject(
  form: {
    name: string;
    description: string;
    contact_id: string;
    status: string;
    start_date: string;
    due_date: string;
  },
  selectedEmployees: string[]
) {
  const user = await getSessionUser();

  const data = {
    name: form.name,
    description: form.description || null,
    contact_id: form.contact_id || null,
    status: form.status || "active",
    start_date: form.start_date || null,
    due_date: form.due_date || null,
    created_by: user?.id,
  };

  const rows = await sql`INSERT INTO projects ${sql(data)} RETURNING id`;
  const inserted = rows[0];

  if (inserted && selectedEmployees.length > 0) {
    const links = selectedEmployees.map((eid) => ({
      project_id: inserted.id,
      employee_id: eid,
    }));
    await sql`INSERT INTO project_employees ${sql(links)}`;
  }

  return { id: inserted.id };
}

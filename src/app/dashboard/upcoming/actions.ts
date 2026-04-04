"use server";

import sql from "@/lib/db";

export async function fetchUpcomingTasks(today: string) {
  return await sql`
    SELECT t.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.status != 'completed' AND t.due_date >= ${today}
    ORDER BY t.due_date ASC
  `;
}

export async function fetchTaskAssignees(taskIds: string[]) {
  if (taskIds.length === 0) return {};
  const rows = await sql`
    SELECT ta.task_id, ta.employee_id, e.id, e.first_name, e.last_name
    FROM task_assignees ta
    JOIN employees e ON ta.employee_id = e.id
    WHERE ta.task_id = ANY(${taskIds})
  `;
  const map: Record<string, { employee_id: string; employees: { id: string; first_name: string; last_name: string } }[]> = {};
  for (const r of rows) {
    if (!map[r.task_id]) map[r.task_id] = [];
    map[r.task_id].push({
      employee_id: r.employee_id,
      employees: { id: r.id, first_name: r.first_name, last_name: r.last_name },
    });
  }
  return map;
}

export async function fetchProjectTaskLinks(taskIds: string[]) {
  if (taskIds.length === 0) return { projectTasks: [], projects: [] };
  const projectTasks = await sql`
    SELECT task_id, project_id FROM project_tasks WHERE task_id = ANY(${taskIds})
  `;
  if (projectTasks.length === 0) return { projectTasks: [], projects: [] };
  const projectIds = [...new Set(projectTasks.map((pt) => pt.project_id))];
  const projects = await sql`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`;
  return { projectTasks, projects };
}

export async function fetchTaskTypes() {
  return await sql`SELECT id, name, color FROM task_types WHERE is_active = true ORDER BY name`;
}

export async function fetchActiveEmployees() {
  return await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
}

export async function fetchContacts() {
  return await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
}

export async function fetchProjects() {
  return await sql`SELECT id, name FROM projects ORDER BY name`;
}

export async function updateTask(taskId: string, data: Record<string, unknown>) {
  await sql`UPDATE tasks SET ${sql(data)} WHERE id = ${taskId}`;
}

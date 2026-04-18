"use server";

import sql from "@/lib/db";
import { currentUserId } from "@/lib/visibility";

export async function fetchAllTasks() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.*, c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE ${vis}
    ORDER BY t.created_at DESC
  `;
  return [...rows] as any;
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
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const projectTasks = await sql`
    SELECT pt.task_id, pt.project_id
    FROM project_tasks pt
    JOIN projects p ON p.id = pt.project_id
    WHERE pt.task_id = ANY(${taskIds}) AND ${vis}
  `;
  if (projectTasks.length === 0) return { projectTasks: [], projects: [] };
  const projectIds = [...new Set(projectTasks.map((pt) => pt.project_id))];
  const projects = await sql`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`;
  return { projectTasks: [...projectTasks] as any, projects: [...projects] as any };
}

export async function fetchContacts() {
  const rows = await sql`SELECT id, first_name, last_name FROM contacts ORDER BY first_name`;
  return [...rows] as any;
}

export async function fetchActiveEmployees() {
  const rows = await sql`SELECT id, first_name, last_name FROM employees WHERE status = 'active' ORDER BY first_name`;
  return [...rows] as any;
}

export async function fetchProjects() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const rows = await sql`SELECT p.id, p.name FROM projects p WHERE ${vis} ORDER BY p.name`;
  return [...rows] as any;
}

export async function fetchTaskTypes() {
  const rows = await sql`SELECT id, name, color FROM task_types WHERE is_active = true ORDER BY name`;
  return [...rows] as any;
}

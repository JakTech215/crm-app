"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function getDashboardStats() {
  const [contactsRes, projectsRes, tasksRes, employeesRes] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM contacts`,
    sql`SELECT COUNT(*) as count FROM projects`,
    sql`SELECT COUNT(*) as count FROM tasks WHERE status != 'completed'`,
    sql`SELECT COUNT(*) as count FROM employees WHERE status = 'active'`,
  ]);
  return {
    contacts: Number(contactsRes[0]?.count ?? 0),
    projects: Number(projectsRes[0]?.count ?? 0),
    tasks: Number(tasksRes[0]?.count ?? 0),
    employees: Number(employeesRes[0]?.count ?? 0),
  };
}

export async function getOverdueTasks(today: string) {
  const rows = await sql`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id
    WHERE t.status != 'completed' AND t.due_date < ${today}
    ORDER BY t.due_date ASC
    LIMIT 10
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    due_date: r.due_date,
    priority: r.priority,
    status: r.status || "pending",
    contact_id: r.contact_id,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name } : null,
  }));
}

export async function getUpcomingTasks(dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id
    WHERE t.status != 'completed' AND t.due_date >= ${dateFrom} AND t.due_date <= ${dateTo}
    ORDER BY t.due_date ASC
    LIMIT 25
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    due_date: r.due_date,
    priority: r.priority,
    status: r.status || "pending",
    contact_id: r.contact_id,
    contact: r.contact_id_ref ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name } : null,
  }));
}

export async function enrichTasksWithProjectsAndAssignees(taskIds: string[]) {
  if (taskIds.length === 0) return { projectMap: {}, assigneeMap: {} };

  const [ptLinks, assignees] = await Promise.all([
    sql`
      SELECT pt.task_id, pt.project_id, p.name as project_name
      FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.task_id = ANY(${taskIds})
    `,
    sql`
      SELECT ta.task_id, e.first_name, e.last_name
      FROM task_assignees ta
      JOIN employees e ON e.id = ta.employee_id
      WHERE ta.task_id = ANY(${taskIds})
    `,
  ]);

  const projectMap: Record<string, { id: string; name: string }[]> = {};
  for (const pt of ptLinks) {
    if (!projectMap[pt.task_id]) projectMap[pt.task_id] = [];
    projectMap[pt.task_id].push({ id: pt.project_id, name: pt.project_name });
  }

  const assigneeMap: Record<string, { name: string }[]> = {};
  for (const a of assignees) {
    if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
    assigneeMap[a.task_id].push({ name: `${a.first_name} ${a.last_name}` });
  }

  return { projectMap, assigneeMap };
}

export async function getCalendarTasks(start: string, end: string) {
  const rows = await sql`
    SELECT id, title, due_date, priority, is_milestone, status
    FROM tasks
    WHERE status != 'completed' AND due_date >= ${start} AND due_date <= ${end}
    ORDER BY due_date ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    due_date: r.due_date,
    priority: r.priority,
    is_milestone: r.is_milestone || false,
  }));
}

export async function getCalendarEvents(start: string, end: string) {
  const rows = await sql`
    SELECT id, title, event_date, event_type, event_time
    FROM events
    WHERE event_date >= ${start} AND event_date <= ${end}
    ORDER BY event_time ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    event_date: r.event_date,
    event_type: r.event_type,
    event_time: r.event_time,
  }));
}

export async function getUpcomingEvents(today: string) {
  const rows = await sql`
    SELECT id, title, event_date, event_type
    FROM events
    WHERE event_date >= ${today}
    ORDER BY event_date ASC
    LIMIT 5
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    event_date: r.event_date,
    event_type: r.event_type,
  }));
}

export async function getRecentNotes() {
  const rows = await sql`
    SELECT id, content, created_at
    FROM notes_standalone
    ORDER BY created_at DESC
    LIMIT 5
  `;
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
  }));
}

export async function getDbHolidays() {
  const rows = await sql`
    SELECT holiday_date, name FROM holidays
  `;
  return rows.map((r) => ({ date: r.holiday_date, name: r.name }));
}

export async function markTaskComplete(taskId: string, completedAt: string) {
  await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
}

export async function updateTaskField(taskId: string, field: string, value: string, completedAt?: string) {
  if (field === "status" && value === "completed" && completedAt) {
    await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
  } else if (field === "priority") {
    await sql`UPDATE tasks SET priority = ${value} WHERE id = ${taskId}`;
  } else if (field === "status") {
    await sql`UPDATE tasks SET status = ${value} WHERE id = ${taskId}`;
  }
}

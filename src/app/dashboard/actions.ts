"use server";

import sql from "@/lib/db";
import { currentUserId, type PrivacyFilter } from "@/lib/visibility";

function projVisFrag(userId: string | null, filter: PrivacyFilter) {
  if (filter === "public") return sql`p.is_private = false`;
  if (filter === "private") {
    return userId ? sql`(p.is_private = true AND p.created_by = ${userId})` : sql`false`;
  }
  return userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
}

function taskVisFrag(userId: string | null, filter: PrivacyFilter) {
  if (filter === "public") return sql`t.is_private = false`;
  if (filter === "private") {
    return userId ? sql`(t.is_private = true AND t.created_by = ${userId})` : sql`false`;
  }
  return userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
}

function eventVisFrag(userId: string | null, filter: PrivacyFilter) {
  if (filter === "public") return sql`e.is_private = false`;
  if (filter === "private") {
    return userId ? sql`(e.is_private = true AND e.created_by = ${userId})` : sql`false`;
  }
  return userId
    ? sql`(e.is_private = false OR e.created_by = ${userId})`
    : sql`e.is_private = false`;
}

function noteVisFrag(userId: string | null, filter: PrivacyFilter) {
  if (filter === "public") return sql`n.is_private = false`;
  if (filter === "private") {
    return userId ? sql`(n.is_private = true AND n.created_by = ${userId})` : sql`false`;
  }
  return userId
    ? sql`(n.is_private = false OR n.created_by = ${userId})`
    : sql`n.is_private = false`;
}

function contactCountVis(userId: string | null, filter: PrivacyFilter) {
  if (filter === "public") return sql`is_private = false`;
  if (filter === "private") {
    return userId ? sql`(is_private = true AND created_by = ${userId})` : sql`false`;
  }
  return userId ? sql`(is_private = false OR created_by = ${userId})` : sql`is_private = false`;
}

export async function getDashboardStats(filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const taskV = taskVisFrag(userId, filterPrivacy);
  const projV = projVisFrag(userId, filterPrivacy);
  const peopleV = contactCountVis(userId, filterPrivacy);
  const [contactsRes, projectsRes, tasksRes, employeesRes] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM contacts WHERE ${peopleV}`,
    sql`SELECT COUNT(*) as count FROM projects p WHERE ${projV}`,
    sql`SELECT COUNT(*) as count FROM tasks t WHERE t.status != 'completed' AND ${taskV}`,
    sql`SELECT COUNT(*) as count FROM employees WHERE status = 'active' AND ${peopleV}`,
  ]);
  return {
    contacts: Number(contactsRes[0]?.count ?? 0),
    projects: Number(projectsRes[0]?.count ?? 0),
    tasks: Number(tasksRes[0]?.count ?? 0),
    employees: Number(employeesRes[0]?.count ?? 0),
  };
}

export async function getOverdueTasks(today: string, filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = taskVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id AND (c.is_private = false OR c.created_by = ${userId})
    WHERE t.status != 'completed' AND t.due_date < ${today} AND ${vis}
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

export async function getUpcomingTasks(dateFrom: string, dateTo: string, filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = taskVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT t.id, t.title, t.due_date, t.priority, t.status, t.contact_id,
           c.id as contact_id_ref, c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id AND (c.is_private = false OR c.created_by = ${userId})
    WHERE t.status != 'completed' AND t.due_date >= ${dateFrom} AND t.due_date <= ${dateTo} AND ${vis}
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

  const userId = await currentUserId();
  const projVis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;

  const [ptLinks, assignees] = await Promise.all([
    sql`
      SELECT pt.task_id, pt.project_id, p.name as project_name
      FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      WHERE pt.task_id = ANY(${taskIds}) AND ${projVis}
    `,
    sql`
      SELECT ta.task_id, e.first_name, e.last_name
      FROM task_assignees ta
      JOIN employees e ON e.id = ta.employee_id AND (e.is_private = false OR e.created_by = ${userId})
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

export async function getCalendarTasks(start: string, end: string, filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = taskVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT t.id, t.title, t.due_date, t.priority, t.is_milestone, t.status
    FROM tasks t
    WHERE t.status != 'completed' AND t.due_date >= ${start} AND t.due_date <= ${end} AND ${vis}
    ORDER BY t.due_date ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    due_date: r.due_date,
    priority: r.priority,
    is_milestone: r.is_milestone || false,
  }));
}

export async function getCalendarEvents(start: string, end: string, filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = eventVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT e.id, e.title, e.event_date, e.event_type, e.event_time
    FROM events e
    WHERE e.event_date >= ${start} AND e.event_date <= ${end} AND ${vis}
    ORDER BY e.event_time ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    event_date: r.event_date,
    event_type: r.event_type,
    event_time: r.event_time,
  }));
}

export async function getUpcomingEvents(today: string, filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = eventVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT e.id, e.title, e.event_date, e.event_type
    FROM events e
    WHERE e.event_date >= ${today} AND ${vis}
    ORDER BY e.event_date ASC
    LIMIT 5
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    event_date: r.event_date,
    event_type: r.event_type,
  }));
}

export async function getRecentNotes(filterPrivacy: PrivacyFilter = "all") {
  const userId = await currentUserId();
  const vis = noteVisFrag(userId, filterPrivacy);
  const rows = await sql`
    SELECT n.id, n.content, n.created_at
    FROM notes_standalone n
    WHERE ${vis}
    ORDER BY n.created_at DESC
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

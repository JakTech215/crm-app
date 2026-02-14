"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  FolderKanban,
  CheckSquare,
  UserCog,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
} from "lucide-react";

interface StatCard {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface TaskContact {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface TaskProject {
  id: string;
  name: string;
}

interface TaskAssignee {
  name: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  contact: TaskContact | null;
  projects: TaskProject[];
  assignees: TaskAssignee[];
}

interface OverdueTask extends UpcomingTask {
  days_overdue: number;
}

interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  is_milestone: boolean;
}

interface CalendarDayData {
  date: string;
  tasks: CalendarTask[];
}

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const priorityDotColors: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [stats, setStats] = useState<StatCard[]>([
    { title: "Total Contacts", value: 0, description: "All contacts", icon: Users, href: "/dashboard/contacts" },
    { title: "Active Contacts", value: 0, description: "Status: active", icon: Users, href: "/dashboard/contacts?status=active" },
    { title: "Projects", value: 0, description: "All projects", icon: FolderKanban, href: "/dashboard/projects" },
    { title: "Active Projects", value: 0, description: "Status: active", icon: FolderKanban, href: "/dashboard/projects?status=active" },
    { title: "Tasks", value: 0, description: "All open tasks", icon: CheckSquare, href: "/dashboard/tasks" },
    { title: "Pending Tasks", value: 0, description: "Status: pending", icon: CheckSquare, href: "/dashboard/tasks?status=pending" },
    { title: "Employees", value: 0, description: "Active team members", icon: UserCog, href: "/dashboard/employees" },
  ]);
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [calendarTaskMap, setCalendarTaskMap] = useState<Record<string, CalendarDayData>>({});
  const [calendarBaseDate, setCalendarBaseDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  // Compute the 3-month range for calendar fetch
  const calendarRange = useMemo(() => {
    const baseY = calendarBaseDate.getFullYear();
    const baseM = calendarBaseDate.getMonth();
    const prevMonth = new Date(baseY, baseM - 1, 1);
    const nextMonthEnd = new Date(baseY, baseM + 2, 0); // last day of next month
    return {
      start: formatDateKey(prevMonth),
      end: formatDateKey(nextMonthEnd),
    };
  }, [calendarBaseDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      // Stats
      const [contactsRes, activeContactsRes, projectsRes, activeProjectsRes, tasksRes, pendingTasksRes, employeesRes] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const c = (r: { error: unknown; count: number | null }) => r.error ? 0 : (r.count ?? 0);

      setStats([
        { title: "Total Contacts", value: c(contactsRes), description: "All contacts", icon: Users, href: "/dashboard/contacts" },
        { title: "Active Contacts", value: c(activeContactsRes), description: "Status: active", icon: Users, href: "/dashboard/contacts?status=active" },
        { title: "Projects", value: c(projectsRes), description: "All projects", icon: FolderKanban, href: "/dashboard/projects" },
        { title: "Active Projects", value: c(activeProjectsRes), description: "Status: active", icon: FolderKanban, href: "/dashboard/projects?status=active" },
        { title: "Tasks", value: c(tasksRes), description: "All open tasks", icon: CheckSquare, href: "/dashboard/tasks" },
        { title: "Pending Tasks", value: c(pendingTasksRes), description: "Status: pending", icon: CheckSquare, href: "/dashboard/tasks?status=pending" },
        { title: "Employees", value: c(employeesRes), description: "Active team members", icon: UserCog, href: "/dashboard/employees" },
      ]);

      // Helper: enrich tasks with contacts, projects, assignees
      async function enrichTasks(tasks: Record<string, unknown>[]): Promise<{ contact: TaskContact | null; projects: TaskProject[]; assignees: TaskAssignee[] }[]> {
        const taskIds = tasks.map((t) => t.id as string);
        if (taskIds.length === 0) return [];

        // Projects
        const taskProjectMap: Record<string, TaskProject[]> = {};
        const { data: ptLinks } = await supabase.from("project_tasks").select("task_id, project_id").in("task_id", taskIds);
        if (ptLinks && ptLinks.length > 0) {
          const projectIds = [...new Set(ptLinks.map((pt: { project_id: string }) => pt.project_id))];
          const { data: projData } = await supabase.from("projects").select("id, name").in("id", projectIds);
          const projNameMap: Record<string, string> = {};
          if (projData) for (const p of projData) projNameMap[p.id] = p.name;
          for (const pt of ptLinks as { task_id: string; project_id: string }[]) {
            const name = projNameMap[pt.project_id];
            if (name) {
              if (!taskProjectMap[pt.task_id]) taskProjectMap[pt.task_id] = [];
              taskProjectMap[pt.task_id].push({ id: pt.project_id, name });
            }
          }
        }

        // Assignees
        const taskAssigneeMap: Record<string, TaskAssignee[]> = {};
        const { data: assignees } = await supabase.from("task_assignees").select("task_id, employee_id, employees(id, first_name, last_name)").in("task_id", taskIds);
        if (assignees) {
          for (const a of assignees as unknown as { task_id: string; employees: { first_name: string; last_name: string } }[]) {
            if (!taskAssigneeMap[a.task_id]) taskAssigneeMap[a.task_id] = [];
            taskAssigneeMap[a.task_id].push({ name: `${a.employees.first_name} ${a.employees.last_name}` });
          }
        }

        return tasks.map((t) => {
          const contactObj = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
          return {
            contact: contactObj ? { id: (contactObj as TaskContact).id, first_name: (contactObj as TaskContact).first_name, last_name: (contactObj as TaskContact).last_name } : null,
            projects: taskProjectMap[t.id as string] || [],
            assignees: taskAssigneeMap[t.id as string] || [],
          };
        });
      }

      // Overdue tasks
      try {
        const { data: overdueTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, priority, contact_id, contacts:contact_id(id, first_name, last_name)")
          .neq("status", "completed")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(10);

        if (overdueTasks && overdueTasks.length > 0) {
          const enriched = await enrichTasks(overdueTasks as Record<string, unknown>[]);
          const todayMs = new Date(today).getTime();
          setOverdue(overdueTasks.map((t: Record<string, unknown>, i: number) => ({
            id: t.id as string,
            title: t.title as string,
            due_date: t.due_date as string,
            priority: t.priority as string,
            ...enriched[i],
            days_overdue: Math.floor((todayMs - new Date(t.due_date as string).getTime()) / (1000 * 60 * 60 * 24)),
          })));
        } else {
          setOverdue([]);
        }
      } catch (e) {
        console.error("Failed to fetch overdue tasks:", e);
      }

      // Calendar tasks
      try {
        const { data: calTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, priority, is_milestone, status")
          .neq("status", "completed")
          .gte("due_date", calendarRange.start)
          .lte("due_date", calendarRange.end)
          .order("due_date", { ascending: true });

        const map: Record<string, CalendarDayData> = {};
        if (calTasks) {
          for (const t of calTasks as { id: string; title: string; due_date: string; priority: string; is_milestone: boolean }[]) {
            const key = t.due_date;
            if (!map[key]) map[key] = { date: key, tasks: [] };
            map[key].tasks.push({ id: t.id, title: t.title, priority: t.priority, is_milestone: t.is_milestone || false });
          }
        }
        setCalendarTaskMap(map);
      } catch (e) {
        console.error("Failed to fetch calendar tasks:", e);
      }

      // Upcoming tasks (next 14 days)
      try {
        const endDate = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split("T")[0]; })();
        const { data: upcomingTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, priority, contact_id, contacts:contact_id(id, first_name, last_name)")
          .neq("status", "completed")
          .gte("due_date", today)
          .lte("due_date", endDate)
          .order("due_date", { ascending: true })
          .limit(10);

        if (upcomingTasks && upcomingTasks.length > 0) {
          const enriched = await enrichTasks(upcomingTasks as Record<string, unknown>[]);
          setUpcoming(upcomingTasks.map((t: Record<string, unknown>, i: number) => ({
            id: t.id as string,
            title: t.title as string,
            due_date: t.due_date as string,
            priority: t.priority as string,
            ...enriched[i],
          })));
        } else {
          setUpcoming([]);
        }
      } catch (e) {
        console.error("Failed to fetch upcoming tasks:", e);
      }

      setLoading(false);
    };

    fetchData();
  }, [calendarRange.start, calendarRange.end]);

  const handleMarkComplete = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId);
    setOverdue((prev) => prev.filter((t) => t.id !== taskId));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Calendar rendering helpers
  const months = useMemo(() => {
    const baseY = calendarBaseDate.getFullYear();
    const baseM = calendarBaseDate.getMonth();
    return [-1, 0, 1].map((offset) => {
      const d = new Date(baseY, baseM + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, [calendarBaseDate]);

  const renderMonth = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const monthName = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div key={`${year}-${month}`}>
        <h3 className="text-sm font-semibold text-center mb-2">{monthName}</h3>
        <div className="grid grid-cols-7 gap-0">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="h-10" />;

            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayData = calendarTaskMap[dateKey];
            const taskCount = dayData?.tasks.length || 0;
            const isToday = dateKey === todayStr;
            const isSelected = dateKey === selectedCalendarDate;
            const isOverdue = dateKey < todayStr && taskCount > 0;
            const hasMilestone = dayData?.tasks.some((t) => t.is_milestone) || false;

            return (
              <div
                key={dateKey}
                className={`h-10 flex flex-col items-center justify-start pt-0.5 cursor-pointer rounded-md transition-colors text-xs
                  ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}
                  ${isSelected ? "bg-blue-100" : isOverdue ? "bg-red-50" : "hover:bg-muted/50"}
                `}
                onClick={() => setSelectedCalendarDate(dateKey === selectedCalendarDate ? null : dateKey)}
              >
                <span className={`text-xs leading-none ${isToday ? "font-bold text-blue-600" : ""}`}>{day}</span>
                {taskCount > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasMilestone && <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />}
                    {dayData!.tasks.slice(0, hasMilestone ? 2 : 3).map((t, ti) => (
                      <div key={ti} className={`w-1.5 h-1.5 rounded-full ${priorityDotColors[t.priority] || "bg-gray-400"}`} />
                    ))}
                    {taskCount > (hasMilestone ? 2 : 3) && (
                      <span className="text-[8px] text-muted-foreground">+{taskCount - (hasMilestone ? 2 : 3)}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedDayTasks = selectedCalendarDate ? calendarTaskMap[selectedCalendarDate]?.tasks || [] : [];

  const renderTaskRow = (task: UpcomingTask | OverdueTask, showOverdue?: boolean) => (
    <div
      key={task.id}
      className={`rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${showOverdue ? "border-l-4 border-l-red-500" : ""}`}
      onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={`capitalize ${priorityColors[task.priority] || ""}`}>
            {task.priority}
          </Badge>
          <span className="text-sm font-medium">{task.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {showOverdue && "days_overdue" in task && (
            <Badge variant="destructive" className="text-xs">
              {(task as OverdueTask).days_overdue}d overdue
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(task.due_date)}
          </span>
          {showOverdue && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkComplete(task.id);
              }}
            >
              Mark Complete
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1.5 ml-1 text-xs text-muted-foreground">
        {task.contact && (
          <span>
            <span
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/contacts/${task.contact!.id}`);
              }}
            >
              {task.contact.first_name}{task.contact.last_name ? ` ${task.contact.last_name}` : ""}
            </span>
          </span>
        )}
        {task.projects.length > 0 && (
          <span>
            {task.projects.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <span
                  className="text-blue-600 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/projects/${p.id}`);
                  }}
                >
                  {p.name}
                </span>
              </span>
            ))}
          </span>
        )}
        {task.assignees.length > 0 && (
          <span>{task.assignees.map((a) => a.name).join(", ")}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your CRM activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
            onClick={() => router.push(stat.href)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stat.value}
              </div>
              <CardDescription>{stat.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue Tasks */}
      {!loading && (
        <Card className={overdue.length > 0 ? "border-red-200" : ""}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${overdue.length > 0 ? "text-red-500" : "text-green-500"}`} />
              <CardTitle className={overdue.length > 0 ? "text-red-700" : "text-green-700"}>
                Overdue Tasks {overdue.length > 0 && `(${overdue.length})`}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? (
              <p className="text-sm text-green-600 font-medium">No overdue tasks!</p>
            ) : (
              <div className="space-y-3">
                {overdue.map((task) => renderTaskRow(task, true))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCalendarBaseDate(new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setCalendarBaseDate(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCalendarBaseDate(new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>Task schedule across 3 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {months.map((m) => renderMonth(m.year, m.month))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Urgent/High</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Medium</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /> Low</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> Milestone</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded ring-2 ring-blue-500" /> Today</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border" /> Overdue</span>
          </div>

          {/* Selected date task list */}
          {selectedCalendarDate && (
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">
                  Tasks on {formatDate(selectedCalendarDate)}
                  {selectedDayTasks.length > 0 && ` (${selectedDayTasks.length})`}
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCalendarDate(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks on this date.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                    >
                      {task.is_milestone && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      <Badge variant="secondary" className={`capitalize ${priorityColors[task.priority] || ""}`}>
                        {task.priority}
                      </Badge>
                      <span className="text-sm">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Tasks</CardTitle>
          <CardDescription>Tasks due in the next 2 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming tasks. Create a task with a due date to see it here.
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((task) => renderTaskRow(task))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

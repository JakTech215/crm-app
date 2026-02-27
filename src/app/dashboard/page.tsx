"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayCST, formatDate, formatDateLong, formatTime, formatMonthYear, nowUTC, nowCST, futureDateCST, formatRelativeTime as fmtRelTime, daysFromToday } from "@/lib/dates";
import { getFederalHolidays, buildHolidayMap } from "@/lib/holidays";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Check,
  Calendar,
  StickyNote,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

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
  status: string;
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

interface DashboardEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
}

interface DashboardNote {
  id: string;
  content: string;
  created_at: string;
}

const eventTypeColors: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-800",
  deadline: "bg-red-100 text-red-800",
  milestone: "bg-amber-100 text-amber-800",
  appointment: "bg-green-100 text-green-800",
  other: "bg-gray-100 text-gray-800",
};

interface CalendarDayData {
  date: string;
  tasks: CalendarTask[];
}

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  event_time: string | null;
}

const eventTypeEmoji: Record<string, string> = {
  meeting: "📅",
  deadline: "🎯",
  milestone: "⭐",
  appointment: "📋",
  other: "📌",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  blocked: "bg-red-100 text-red-800",
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
    { title: "Total Projects", value: 0, description: "All projects", icon: FolderKanban, href: "/dashboard/projects" },
    { title: "Total Tasks", value: 0, description: "All open tasks", icon: CheckSquare, href: "/dashboard/tasks" },
    { title: "Total Employees", value: 0, description: "Active team members", icon: UserCog, href: "/dashboard/employees" },
  ]);
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [dashEvents, setDashEvents] = useState<DashboardEvent[]>([]);
  const [dashNotes, setDashNotes] = useState<DashboardNote[]>([]);
  const [calendarTaskMap, setCalendarTaskMap] = useState<Record<string, CalendarDayData>>({});
  const [calendarEventMap, setCalendarEventMap] = useState<Record<string, CalendarEvent[]>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, string[]>>({});
  const [calendarBaseDate, setCalendarBaseDate] = useState(() => {
    const now = nowCST();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  // Upcoming tasks date range filter — defaults to today through 14 days out
const [upcomingDateFrom, setUpcomingDateFrom] = useState<string>(() => todayCST());
const [upcomingDateTo, setUpcomingDateTo] = useState<string>(() => todayCST());

  const todayStr = useMemo(() => todayCST(), []);

  // Compute the 3-month range for calendar fetch
  const calendarRange = useMemo(() => {
    const baseY = calendarBaseDate.getFullYear();
    const baseM = calendarBaseDate.getMonth();
    const prevMonth = new Date(baseY, baseM - 1, 1);
    const nextMonthEnd = new Date(baseY, baseM + 2, 0);
    return {
      start: formatDateKey(prevMonth),
      end: formatDateKey(nextMonthEnd),
    };
  }, [calendarBaseDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const today = todayCST();

      // Stats
      const [contactsRes, projectsRes, tasksRes, employeesRes] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const c = (r: { error: unknown; count: number | null }) => r.error ? 0 : (r.count ?? 0);

      setStats([
        { title: "Total Contacts", value: c(contactsRes), description: "All contacts", icon: Users, href: "/dashboard/contacts" },
        { title: "Total Projects", value: c(projectsRes), description: "All projects", icon: FolderKanban, href: "/dashboard/projects" },
        { title: "Total Tasks", value: c(tasksRes), description: "All open tasks", icon: CheckSquare, href: "/dashboard/tasks" },
        { title: "Total Employees", value: c(employeesRes), description: "Active team members", icon: UserCog, href: "/dashboard/employees" },
      ]);

      // Helper: enrich tasks with contacts, projects, assignees
      async function enrichTasks(tasks: Record<string, unknown>[]): Promise<{ contact: TaskContact | null; projects: TaskProject[]; assignees: TaskAssignee[] }[]> {
        const taskIds = tasks.map((t) => t.id as string);
        if (taskIds.length === 0) return [];

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
          .select("id, title, due_date, priority, status, contact_id, contacts:contact_id(id, first_name, last_name)")
          .neq("status", "completed")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(10);

        if (overdueTasks && overdueTasks.length > 0) {
          const enriched = await enrichTasks(overdueTasks as Record<string, unknown>[]);
          setOverdue(overdueTasks.map((t: Record<string, unknown>, i: number) => ({
            id: t.id as string,
            title: t.title as string,
            due_date: t.due_date as string,
            priority: t.priority as string,
            status: (t.status as string) || "pending",
            ...enriched[i],
            days_overdue: daysFromToday(t.due_date as string),
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

      // Calendar events
      try {
        const { data: calEvents } = await supabase
          .from("events")
          .select("id, title, event_date, event_type, event_time")
          .gte("event_date", calendarRange.start)
          .lte("event_date", calendarRange.end)
          .order("event_time", { ascending: true });

        const evtMap: Record<string, CalendarEvent[]> = {};
        if (calEvents) {
          for (const e of calEvents as { id: string; title: string; event_date: string; event_type: string; event_time: string | null }[]) {
            if (!evtMap[e.event_date]) evtMap[e.event_date] = [];
            evtMap[e.event_date].push({ id: e.id, title: e.title, event_type: e.event_type, event_time: e.event_time });
          }
        }
        setCalendarEventMap(evtMap);

        // Fetch Google Calendar events and merge in
        try {
          const gcalRes = await fetch(`/api/google/events?start=${calendarRange.start}&end=${calendarRange.end}`);
          if (gcalRes.ok) {
            const gcalData = await gcalRes.json();
            if (gcalData.events?.length > 0) {
              setCalendarEventMap(prev => {
                const merged = { ...prev };
                for (const e of gcalData.events) {
                  const dateKey = e.start.split('T')[0];
                  if (!merged[dateKey]) merged[dateKey] = [];
                  merged[dateKey].push({
                    id: e.id,
                    title: e.title || '(No title)',
                    event_type: 'google_calendar',
                    event_time: e.start.includes('T') ? e.start.split('T')[1].substring(0, 5) : null
                  });
                }
                return merged;
              });
            }
          }
        } catch (gcalErr) {
          console.error("Failed to fetch Google Calendar events:", gcalErr);
        }
      } catch (e) {
        console.error("Failed to fetch calendar events:", e);
      }

      // Upcoming tasks (filtered by date range)
      try {
        const { data: upcomingTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, priority, status, contact_id, contacts:contact_id(id, first_name, last_name)")
          .neq("status", "completed")
          .gte("due_date", upcomingDateFrom)
          .lte("due_date", upcomingDateTo)
          .order("due_date", { ascending: true })
          .limit(25);

        if (upcomingTasks && upcomingTasks.length > 0) {
          const enriched = await enrichTasks(upcomingTasks as Record<string, unknown>[]);
          setUpcoming(upcomingTasks.map((t: Record<string, unknown>, i: number) => ({
            id: t.id as string,
            title: t.title as string,
            due_date: t.due_date as string,
            priority: t.priority as string,
            status: (t.status as string) || "pending",
            ...enriched[i],
          })));
        } else {
          setUpcoming([]);
        }
      } catch (e) {
        console.error("Failed to fetch upcoming tasks:", e);
      }

      // Upcoming events
      try {
        const { data: evts } = await supabase
          .from("events")
          .select("id, title, event_date, event_type")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(5);
        setDashEvents(evts || []);
      } catch (e) {
        console.error("Failed to fetch events:", e);
      }

      // Recent notes
      try {
        const { data: nts } = await supabase
          .from("notes_standalone")
          .select("id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        setDashNotes(nts || []);
      } catch (e) {
        console.error("Failed to fetch notes:", e);
      }

      // Fetch holidays
      try {
        const federalHolidays = await getFederalHolidays();
        const { data: dbHolidays } = await supabase
          .from("holidays")
          .select("holiday_date, name");
        const allHolidays = [
          ...federalHolidays.map((h) => ({ date: h.date, name: h.name })),
          ...(dbHolidays || []).map((h: { holiday_date: string; name: string }) => ({ date: h.holiday_date, name: h.name })),
        ];
        setHolidayMap(buildHolidayMap(allHolidays));
      } catch (e) {
        console.error("Failed to fetch holidays:", e);
      }

      setLoading(false);
    };

    fetchData();
  }, [calendarRange.start, calendarRange.end, upcomingDateFrom, upcomingDateTo]);

  const handleMarkComplete = async (taskId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  console.log("current user:", user?.id);
  const { error } = await supabase.from("tasks").update({ status: "completed", completed_at: nowUTC() }).eq("id", taskId);
  console.log("markComplete error:", JSON.stringify(error));
  if (!error) {
    setOverdue((prev) => prev.filter((t) => t.id !== taskId));
  }
};
  const handleDashboardInlineUpdate = async (taskId: string, field: string, value: string) => {
    const key = `${taskId}-${field}`;
    setSavingCell(key);
    setSavedCell(null);
    const updateData: Record<string, unknown> = { [field]: value };
    if (field === "status" && value === "completed") {
      updateData.completed_at = nowUTC();
    }
    await supabase.from("tasks").update(updateData).eq("id", taskId);
    setOverdue((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } as typeof t : t));
    setUpcoming((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t));
    setSavingCell(null);
    setSavedCell(key);
    setTimeout(() => setSavedCell((prev) => prev === key ? null : prev), 1500);
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
    const monthName = formatMonthYear(new Date(year, month, 1));
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
            const dayTasks = dayData?.tasks || [];
            const taskCount = dayTasks.length;
            const dayEvents = calendarEventMap[dateKey] || [];
            const dayHols = holidayMap[dateKey] || [];
            const isToday = dateKey === todayStr;
            const isSelected = dateKey === selectedCalendarDate;
            const isOverdue = dateKey < todayStr && taskCount > 0;
            const hasMilestone = dayTasks.some((t) => t.is_milestone);
            const isHoliday = dayHols.length > 0;
            const totalItems = taskCount + dayEvents.length + dayHols.length;

            return (
              <Tooltip key={dateKey}>
                <TooltipTrigger asChild>
                  <div
                    className={`h-10 flex flex-col items-center justify-start pt-0.5 cursor-pointer rounded-md transition-colors text-xs
                      ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}
                      ${isSelected ? "bg-blue-100" : isHoliday ? "bg-emerald-50" : isOverdue ? "bg-red-50" : "hover:bg-muted/50"}
                    `}
                    onClick={() => setSelectedCalendarDate(dateKey === selectedCalendarDate ? null : dateKey)}
                  >
                    <span className={`text-xs leading-none ${isToday ? "font-bold text-blue-600" : isHoliday ? "font-semibold text-emerald-700" : ""}`}>{day}</span>
                    {(taskCount > 0 || isHoliday || dayEvents.length > 0) && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {isHoliday && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {hasMilestone && <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />}
                        {dayTasks.slice(0, hasMilestone ? 2 : 3).map((t, ti) => (
                          <div key={ti} className={`w-1.5 h-1.5 rounded-full ${priorityDotColors[t.priority] || "bg-gray-400"}`} />
                        ))}
                        {taskCount > (hasMilestone ? 2 : 3) && (
                          <span className="text-[8px] text-muted-foreground">+{taskCount - (hasMilestone ? 2 : 3)}</span>
                        )}
                        {dayEvents.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[300px] p-0 bg-popover text-popover-foreground border shadow-lg"
                  sideOffset={8}
                  side="bottom"
                  align="center"
                >
                  <div className="px-3 py-1.5 border-b bg-muted/30">
                    <p className="font-semibold text-xs">{formatDateLong(dateKey)}</p>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    {totalItems === 0 ? (
                      <p className="text-xs text-muted-foreground">No events scheduled</p>
                    ) : totalItems > 10 ? (
                      <div className="text-xs text-muted-foreground">
                        {taskCount > 0 && <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>}
                        {taskCount > 0 && dayEvents.length > 0 && ", "}
                        {dayEvents.length > 0 && <span>{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</span>}
                        {(taskCount > 0 || dayEvents.length > 0) && dayHols.length > 0 && ", "}
                        {dayHols.length > 0 && <span>{dayHols.length} holiday{dayHols.length !== 1 ? "s" : ""}</span>}
                        <p className="mt-1">Click to view all</p>
                      </div>
                    ) : (
                      <>
                        {dayTasks.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Tasks ({dayTasks.length})
                            </p>
                            {dayTasks.slice(0, 4).map((t) => (
                              <div key={t.id} className="flex items-center gap-1.5 text-xs py-0.5">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDotColors[t.priority] || "bg-gray-400"}`} />
                                <span className="truncate">{t.title}</span>
                                <span className="text-muted-foreground shrink-0 capitalize">({t.priority})</span>
                              </div>
                            ))}
                            {dayTasks.length > 4 && (
                              <p className="text-[10px] text-muted-foreground pl-3.5">+{dayTasks.length - 4} more</p>
                            )}
                          </div>
                        )}
                        {dayEvents.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Events ({dayEvents.length})
                            </p>
                            {dayEvents.slice(0, 4).map((ev) => (
                              <div key={ev.id} className="flex items-center gap-1.5 text-xs py-0.5">
                                <span className="shrink-0">{eventTypeEmoji[ev.event_type] || "📌"}</span>
                                <span className="truncate">{ev.title}</span>
                                {ev.event_time && (
                                  <span className="text-muted-foreground shrink-0">— {formatTime(ev.event_time)}</span>
                                )}
                              </div>
                            ))}
                            {dayEvents.length > 4 && (
                              <p className="text-[10px] text-muted-foreground pl-3.5">+{dayEvents.length - 4} more</p>
                            )}
                          </div>
                        )}
                        {dayHols.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Holidays ({dayHols.length})
                            </p>
                            {dayHols.map((name, hi) => (
                              <div key={hi} className="flex items-center gap-1.5 text-xs py-0.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span>{name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
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
          <Select value={task.priority} onValueChange={(v) => handleDashboardInlineUpdate(task.id, "priority", v)}>
            <SelectTrigger className={`h-7 w-[100px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${priorityColors[task.priority] || ""}`} onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          {savingCell === `${task.id}-priority` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {savedCell === `${task.id}-priority` && <Check className="h-3 w-3 text-green-600" />}
          <span className="text-sm font-medium">{task.title}</span>
          <Select value={task.status || "pending"} onValueChange={(v) => handleDashboardInlineUpdate(task.id, "status", v)}>
            <SelectTrigger className={`h-7 w-[130px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${statusColors[task.status || "pending"] || ""}`} onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          {savingCell === `${task.id}-status` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {savedCell === `${task.id}-status` && <Check className="h-3 w-3 text-green-600" />}
        </div>
        <div className="flex items-center gap-2">
          {showOverdue && "days_overdue" in task && (
            <Badge variant="destructive" className="text-xs">
              {(task as OverdueTask).days_overdue}d overdue
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span>
          {showOverdue && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); handleMarkComplete(task.id); }}
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
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/contacts/${task.contact!.id}`); }}
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
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/projects/${p.id}`); }}
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
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
            onClick={() => router.push(stat.href)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
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
                  const now = nowCST();
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
          <TooltipProvider delayDuration={0}>
            <div className="grid grid-cols-3 gap-6">
              {months.map((m) => renderMonth(m.year, m.month))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Urgent/High</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Medium</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /> Low</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> Milestone</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded ring-2 ring-blue-500" /> Today</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border" /> Overdue</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Holiday</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400" /> Google Calendar</span>
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
              {holidayMap[selectedCalendarDate] && (
                <div className="mb-3 space-y-1">
                  {holidayMap[selectedCalendarDate].map((name, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 text-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      {name}
                    </div>
                  ))}
                </div>
              )}
              {selectedDayTasks.length === 0 && !holidayMap[selectedCalendarDate] ? (
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

      {/* Upcoming Events & Recent Notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Upcoming Events</CardTitle>
              <CardDescription>Next scheduled events</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/events")}>View All</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dashEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              <div className="space-y-2">
                {dashEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/events/${evt.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`capitalize text-xs ${eventTypeColors[evt.event_type] || ""}`}>
                        {evt.event_type}
                      </Badge>
                      <span className="text-sm font-medium">{evt.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(evt.event_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" /> Recent Notes</CardTitle>
              <CardDescription>Latest quick notes</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/notes")}>View All</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dashNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-2">
                {dashNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/notes?editNote=${note.id}`)}
                  >
                    <p className="text-sm line-clamp-2">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtRelTime(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Upcoming Tasks</CardTitle>
              <CardDescription>Tasks due in selected date range</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                <Input
                  type="date"
                  value={upcomingDateFrom}
                  onChange={(e) => setUpcomingDateFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                <Input
                  type="date"
                  value={upcomingDateTo}
                  onChange={(e) => setUpcomingDateTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setUpcomingDateFrom(todayCST());
                  setUpcomingDateTo(todayCST());
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks found in this date range.
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

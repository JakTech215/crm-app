"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, FolderKanban, CheckSquare, UserCog } from "lucide-react";

interface StatCard {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface RecentItem {
  id: string;
  label: string;
  type: string;
  date: string;
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

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

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
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      // Stats - check errors individually
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

      // Recent activity
      try {
        let contactsQuery = supabase.from("contacts").select("id, first_name, last_name, created_at").order("created_at", { ascending: false }).limit(3);
        if (dateFrom) contactsQuery = contactsQuery.gte("created_at", dateFrom);
        if (dateTo) contactsQuery = contactsQuery.lte("created_at", dateTo + "T23:59:59");

        let projectsQuery = supabase.from("projects").select("id, name, created_at").order("created_at", { ascending: false }).limit(3);
        if (dateFrom) projectsQuery = projectsQuery.gte("created_at", dateFrom);
        if (dateTo) projectsQuery = projectsQuery.lte("created_at", dateTo + "T23:59:59");

        let tasksQuery = supabase.from("tasks").select("id, title, created_at").order("created_at", { ascending: false }).limit(3);
        if (dateFrom) tasksQuery = tasksQuery.gte("created_at", dateFrom);
        if (dateTo) tasksQuery = tasksQuery.lte("created_at", dateTo + "T23:59:59");

        const [recentContacts, recentProjects, recentTasks] = await Promise.all([
          contactsQuery,
          projectsQuery,
          tasksQuery,
        ]);

        const items: RecentItem[] = [
          ...(recentContacts.data || []).map((c: { id: string; first_name: string; last_name: string | null; created_at: string }) => ({
            id: c.id,
            label: `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`,
            type: "Contact",
            date: c.created_at,
            href: `/dashboard/contacts/${c.id}`,
          })),
          ...(recentProjects.data || []).map((p) => ({
            id: p.id,
            label: p.name,
            type: "Project",
            date: p.created_at,
            href: `/dashboard/projects/${p.id}`,
          })),
          ...(recentTasks.data || []).map((t) => ({
            id: t.id,
            label: t.title,
            type: "Task",
            date: t.created_at,
            href: `/dashboard/tasks/${t.id}`,
          })),
        ];
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecent(items.slice(0, 5));
      } catch (e) {
        console.error("Failed to fetch recent activity:", e);
      }

      // Upcoming tasks
      try {
        const startDate = dateFrom || new Date().toISOString().split("T")[0];
        const endDate = dateTo || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split("T")[0]; })();

        const { data: upcomingTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, priority, contact_id, contacts:contact_id(id, first_name, last_name)")
          .neq("status", "completed")
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .order("due_date", { ascending: true })
          .limit(5);

        const taskIds = (upcomingTasks || []).map((t: { id: string }) => t.id);

        // Fetch project links
        const taskProjectMap: Record<string, TaskProject[]> = {};
        if (taskIds.length > 0) {
          const { data: ptLinks } = await supabase
            .from("project_tasks")
            .select("task_id, project_id")
            .in("task_id", taskIds);

          if (ptLinks && ptLinks.length > 0) {
            const projectIds = [...new Set(ptLinks.map((pt: { project_id: string }) => pt.project_id))];
            const { data: projData } = await supabase
              .from("projects")
              .select("id, name")
              .in("id", projectIds);

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
        }

        // Fetch assignees
        const taskAssigneeMap: Record<string, TaskAssignee[]> = {};
        if (taskIds.length > 0) {
          const { data: assignees } = await supabase
            .from("task_assignees")
            .select("task_id, employee_id, employees(id, first_name, last_name)")
            .in("task_id", taskIds);

          if (assignees) {
            for (const a of assignees as unknown as { task_id: string; employees: { first_name: string; last_name: string } }[]) {
              if (!taskAssigneeMap[a.task_id]) taskAssigneeMap[a.task_id] = [];
              taskAssigneeMap[a.task_id].push({ name: `${a.employees.first_name} ${a.employees.last_name}` });
            }
          }
        }

        const enriched: UpcomingTask[] = (upcomingTasks || []).map((t: Record<string, unknown>) => {
          const contactObj = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
          return {
            id: t.id as string,
            title: t.title as string,
            due_date: t.due_date as string,
            priority: t.priority as string,
            contact: contactObj ? { id: (contactObj as TaskContact).id, first_name: (contactObj as TaskContact).first_name, last_name: (contactObj as TaskContact).last_name } : null,
            projects: taskProjectMap[t.id as string] || [],
            assignees: taskAssigneeMap[t.id as string] || [],
          };
        });

        setUpcoming(enriched);
      } catch (e) {
        console.error("Failed to fetch upcoming tasks:", e);
      }

      setLoading(false);
    };

    fetchData();
  }, [dateFrom, dateTo]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const typeColors: Record<string, string> = {
    Contact: "bg-blue-100 text-blue-800",
    Project: "bg-purple-100 text-purple-800",
    Task: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your CRM activity.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="dateFrom" className="text-sm whitespace-nowrap">From</Label>
          <Input id="dateFrom" type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="dateTo" className="text-sm whitespace-nowrap">To</Label>
          <Input id="dateTo" type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Clear
          </Button>
        )}
      </div>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across the CRM</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity yet. Start by adding contacts, projects, or tasks.
              </p>
            ) : (
              <div className="space-y-3">
                {recent.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(item.href)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className={typeColors[item.type] || ""}>
                        {item.type}
                      </Badge>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
                {upcoming.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${priorityColors[task.priority] || ""}`}
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-sm font-medium">{task.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(task.due_date)}
                      </span>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
import { Users, FolderKanban, CheckSquare, UserCog } from "lucide-react";

interface StatCard {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface RecentItem {
  id: string;
  label: string;
  type: string;
  date: string;
  href: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
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
    { title: "Total Contacts", value: 0, description: "Active contacts", icon: Users },
    { title: "Projects", value: 0, description: "Active projects", icon: FolderKanban },
    { title: "Tasks", value: 0, description: "Pending tasks", icon: CheckSquare },
    { title: "Employees", value: 0, description: "Team members", icon: UserCog },
  ]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [contactsRes, projectsRes, tasksRes, employeesRes] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      setStats([
        { title: "Total Contacts", value: contactsRes.count ?? 0, description: "Active contacts", icon: Users },
        { title: "Projects", value: projectsRes.count ?? 0, description: "Active projects", icon: FolderKanban },
        { title: "Tasks", value: tasksRes.count ?? 0, description: "Pending tasks", icon: CheckSquare },
        { title: "Employees", value: employeesRes.count ?? 0, description: "Team members", icon: UserCog },
      ]);

      // Recent activity: last 5 items across contacts, projects, tasks
      const [recentContacts, recentProjects, recentTasks] = await Promise.all([
        supabase.from("contacts").select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("projects").select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("tasks").select("id, title, created_at").order("created_at", { ascending: false }).limit(3),
      ]);

      const items: RecentItem[] = [
        ...(recentContacts.data || []).map((c) => ({
          id: c.id,
          label: c.name,
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

      // Upcoming tasks: due in the next 14 days
      const today = new Date().toISOString().split("T")[0];
      const twoWeeks = new Date();
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      const futureDate = twoWeeks.toISOString().split("T")[0];

      const { data: upcomingTasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority")
        .neq("status", "completed")
        .gte("due_date", today)
        .lte("due_date", futureDate)
        .order("due_date", { ascending: true })
        .limit(5);

      setUpcoming(upcomingTasks || []);
      setLoading(false);
    };

    fetchData();
  }, []);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
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
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  >
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

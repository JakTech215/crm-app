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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshCw, Loader2, Check } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

interface TaskAssignee {
  employee_id: string;
  employees: Employee;
}

interface ContactInfo {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  task_type_id: string | null;
  is_recurring: boolean;
  created_at: string;
  task_assignees: TaskAssignee[];
  contacts: ContactInfo | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

const formatRelativeTime = (dateStr: string) => {
  const due = new Date(dateStr);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const isOverdue = diffMs < 0;

  let text: string;
  if (days > 30) text = `${Math.floor(days / 30)}mo`;
  else if (days > 0) text = `${days}d`;
  else if (hours > 0) text = `${hours}h`;
  else text = "<1h";

  return isOverdue
    ? { text: `${text} overdue`, className: "text-red-600" }
    : { text: `in ${text}`, className: "text-muted-foreground" };
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

const COLOR_MAP: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800",
  red: "bg-red-100 text-red-800",
  orange: "bg-orange-100 text-orange-800",
  yellow: "bg-yellow-100 text-yellow-800",
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
  pink: "bg-pink-100 text-pink-800",
};

interface TaskType {
  id: string;
  name: string;
  color: string;
}

interface TaskProject {
  id: string;
  name: string;
}

export default function UpcomingTasksPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [taskProjectMap, setTaskProjectMap] = useState<Record<string, TaskProject[]>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  const fetchTasks = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .neq("status", "completed")
      .gte("due_date", today)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Failed to fetch upcoming tasks:", error);
      setLoading(false);
      return;
    }

    const taskIds = (data || []).map((t: { id: string }) => t.id);
    const assigneeMap: Record<string, TaskAssignee[]> = {};

    if (taskIds.length > 0) {
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, employee_id, employees(id, first_name, last_name)")
        .in("task_id", taskIds);

      if (assignees) {
        for (const a of assignees as unknown as (TaskAssignee & {
          task_id: string;
        })[]) {
          if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
          assigneeMap[a.task_id].push(a);
        }
      }
    }

    const tasksWithAssignees = (data || []).map((t: Task) => ({
      ...t,
      task_assignees: assigneeMap[t.id] || [],
    }));

    setTasks(tasksWithAssignees as Task[]);

    // Fetch project links from project_tasks junction table
    if (taskIds.length > 0) {
      const { data: projectTasks } = await supabase
        .from("project_tasks")
        .select("task_id, project_id")
        .in("task_id", taskIds);

      if (projectTasks && projectTasks.length > 0) {
        const projectIds = [
          ...new Set(projectTasks.map((pt: { project_id: string }) => pt.project_id)),
        ];

        const { data: projectData } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        const projectNameMap: Record<string, string> = {};
        if (projectData) {
          for (const p of projectData) {
            projectNameMap[p.id] = p.name;
          }
        }

        const tpMap: Record<string, TaskProject[]> = {};
        for (const pt of projectTasks as { task_id: string; project_id: string }[]) {
          const name = projectNameMap[pt.project_id];
          if (name) {
            if (!tpMap[pt.task_id]) tpMap[pt.task_id] = [];
            tpMap[pt.task_id].push({ id: pt.project_id, name });
          }
        }

        setTaskProjectMap(tpMap);
      }
    }

    setLoading(false);
  };

  const fetchTaskTypes = async () => {
    const { data } = await supabase
      .from("task_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name");
    setTaskTypes(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name");
    setEmployees(data || []);
  };

  const handleInlineUpdate = async (taskId: string, field: string, value: string) => {
    const key = `${taskId}-${field}`;
    setSavingCell(key);
    setSavedCell(null);
    const updateData: Record<string, unknown> = { [field]: value };
    if (field === "status" && value === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
    await supabase.from("tasks").update(updateData).eq("id", taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t));
    setSavingCell(null);
    setSavedCell(key);
    setTimeout(() => setSavedCell((prev) => prev === key ? null : prev), 1500);
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchTaskTypes();
  }, []);

  // Client-side filtering
  const filteredTasks = tasks.filter((task) => {
    // Assignee filter
    if (assigneeFilter !== "all") {
      const hasAssignee = task.task_assignees.some(
        (a) => a.employee_id === assigneeFilter
      );
      if (!hasAssignee) return false;
    }

    // Date from filter
    if (dateFrom && task.due_date) {
      if (task.due_date < dateFrom) return false;
    }

    // Date to filter
    if (dateTo && task.due_date) {
      if (task.due_date > dateTo) return false;
    }

    return true;
  });

  const renderTaskRow = (task: Task) => (
    <TableRow
      key={task.id}
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
    >
      <TableCell>
        <div className="font-medium flex items-center gap-1">
          {task.is_recurring && <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />}
          {task.title}
        </div>
      </TableCell>
      <TableCell>
        {(() => {
          const tt = taskTypes.find((x) => x.id === task.task_type_id);
          return tt ? <Badge variant="secondary" className={COLOR_MAP[tt.color] || ""}>{tt.name}</Badge> : <span className="text-muted-foreground">—</span>;
        })()}
      </TableCell>
      <TableCell>
        {task.contacts ? (
          <span
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/contacts/${task.contacts!.id}`);
            }}
          >
            {contactName(task.contacts)}
          </span>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>
      <TableCell>
        {(() => {
          const taskProjects = taskProjectMap[task.id];
          if (!taskProjects || taskProjects.length === 0) {
            return <span className="text-muted-foreground">{"\u2014"}</span>;
          }
          if (taskProjects.length <= 2) {
            return (
              <div className="flex flex-wrap gap-1">
                {taskProjects.map((p) => (
                  <span
                    key={p.id}
                    className="text-blue-600 hover:underline cursor-pointer text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/projects/${p.id}`);
                    }}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            );
          }
          return (
            <Popover>
              <PopoverTrigger asChild>
                <span
                  className="text-blue-600 hover:underline cursor-pointer text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {taskProjects.length} Projects
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  {taskProjects.map((p) => (
                    <div
                      key={p.id}
                      className="text-sm text-blue-600 hover:underline cursor-pointer px-2 py-1 rounded hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/projects/${p.id}`);
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })()}
      </TableCell>
      <TableCell>
        {task.task_assignees?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {task.task_assignees.map((a) => (
              <Badge key={a.employee_id} variant="outline" className="text-xs">
                {a.employees ? employeeName(a.employees) : ""}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Select value={task.priority} onValueChange={(v) => handleInlineUpdate(task.id, "priority", v)}>
            <SelectTrigger className={`h-7 w-[100px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${priorityColors[task.priority] || ""}`}>
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
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Select value={task.status} onValueChange={(v) => handleInlineUpdate(task.id, "status", v)}>
            <SelectTrigger className={`h-7 w-[110px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${statusColors[task.status] || ""}`}>
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
      </TableCell>
      <TableCell>
        {task.due_date ? (
          <div>
            <div className="text-sm">
              {new Date(task.due_date).toLocaleDateString()}
            </div>
            {(() => {
              const rel = formatRelativeTime(task.due_date);
              return (
                <div className={`text-xs ${rel.className}`}>{rel.text}</div>
              );
            })()}
          </div>
        ) : (
          "\u2014"
        )}
      </TableCell>
    </TableRow>
  );

  const renderTable = (taskList: Task[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Projects</TableHead>
          <TableHead>Employees</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8">
              Loading...
            </TableCell>
          </TableRow>
        ) : taskList.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="text-center text-muted-foreground py-8"
            >
              No upcoming tasks found.
            </TableCell>
          </TableRow>
        ) : (
          taskList.map(renderTaskRow)
        )}
      </TableBody>
    </Table>
  );

  const renderGroupedByContact = () => {
    const groups: Record<string, { contact: ContactInfo | null; tasks: Task[] }> =
      {};

    for (const task of filteredTasks) {
      const key = task.contact_id || "__none__";
      if (!groups[key]) {
        groups[key] = { contact: task.contacts, tasks: [] };
      }
      groups[key].tasks.push(task);
    }

    const entries = Object.entries(groups);

    if (entries.length === 0 && !loading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No upcoming tasks found.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {entries.map(([key, group]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-lg">
                {group.contact
                  ? contactName(group.contact)
                  : "No Contact"}
              </CardTitle>
              <CardDescription>
                {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(group.tasks)}</CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderGroupedByEmployee = () => {
    const groups: Record<string, { employee: Employee | null; tasks: Task[] }> =
      {};

    for (const task of filteredTasks) {
      if (task.task_assignees.length === 0) {
        const key = "__unassigned__";
        if (!groups[key]) {
          groups[key] = { employee: null, tasks: [] };
        }
        groups[key].tasks.push(task);
      } else {
        for (const assignee of task.task_assignees) {
          const key = assignee.employee_id;
          if (!groups[key]) {
            groups[key] = { employee: assignee.employees, tasks: [] };
          }
          groups[key].tasks.push(task);
        }
      }
    }

    const entries = Object.entries(groups);

    if (entries.length === 0 && !loading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No upcoming tasks found.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {entries.map(([key, group]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-lg">
                {group.employee ? employeeName(group.employee) : "Unassigned"}
              </CardTitle>
              <CardDescription>
                {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(group.tasks)}</CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Tasks</h1>
        <p className="text-muted-foreground">
          Tasks due soon, grouped and filtered.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {employeeName(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {groupBy === "contact" ? (
        renderGroupedByContact()
      ) : groupBy === "employee" ? (
        renderGroupedByEmployee()
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Upcoming Tasks</CardTitle>
            <CardDescription>
              {filteredTasks.length} task
              {filteredTasks.length !== 1 ? "s" : ""} due
            </CardDescription>
          </CardHeader>
          <CardContent>{renderTable(filteredTasks)}</CardContent>
        </Card>
      )}
    </div>
  );
}

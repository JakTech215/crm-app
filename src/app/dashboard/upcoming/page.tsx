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



export default function UpcomingTasksPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name");
    setEmployees(data || []);
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
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
        <div className="font-medium">{task.title}</div>
      </TableCell>
      <TableCell>
        {task.contacts ? contactName(task.contacts) : "\u2014"}
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
      <TableCell>
        <Badge
          variant="secondary"
          className={`capitalize ${priorityColors[task.priority] || ""}`}
        >
          {task.priority}
        </Badge>
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
          <TableHead>Contact</TableHead>
          <TableHead>Assignees</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8">
              Loading...
            </TableCell>
          </TableRow>
        ) : taskList.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
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

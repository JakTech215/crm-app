"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/dates";

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

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskProject {
  id: string;
  name: string;
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
  contacts: ContactOption | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

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

export default function TaskHistoryPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectMap, setProjectMap] = useState<Record<string, TaskProject[]>>({});
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterContact, setFilterContact] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch tasks:", error);
      setLoading(false);
      return;
    }

    const taskIds = (data || []).map((t: { id: string }) => t.id);
    const aMap: Record<string, TaskAssignee[]> = {};

    if (taskIds.length > 0) {
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, employee_id, employees(id, first_name, last_name)")
        .in("task_id", taskIds);

      if (assignees) {
        for (const a of assignees as unknown as (TaskAssignee & { task_id: string })[]) {
          if (!aMap[a.task_id]) aMap[a.task_id] = [];
          aMap[a.task_id].push(a);
        }
      }
    }

    const tasksWithAssignees = (data || []).map((t: Task) => ({
      ...t,
      task_assignees: aMap[t.id] || [],
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

        const taskProjectMap: Record<string, TaskProject[]> = {};
        for (const pt of projectTasks as { task_id: string; project_id: string }[]) {
          const name = projectNameMap[pt.project_id];
          if (name) {
            if (!taskProjectMap[pt.task_id]) taskProjectMap[pt.task_id] = [];
            taskProjectMap[pt.task_id].push({ id: pt.project_id, name });
          }
        }

        setProjectMap(taskProjectMap);
      }
    }

    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setContacts(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name");
    setEmployees(data || []);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setProjects(data || []);
  };

  const fetchTaskTypes = async () => {
    const { data } = await supabase
      .from("task_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name");
    setTaskTypes(data || []);
  };

  useEffect(() => {
    fetchTasks();
    fetchContacts();
    fetchEmployees();
    fetchProjects();
    fetchTaskTypes();
  }, []);

  const filteredTasks = tasks.filter((task) => {
    // Contact filter
    if (filterContact !== "all" && task.contact_id !== filterContact) {
      return false;
    }

    // Employee filter — match if any assignee matches
    if (filterEmployee !== "all") {
      const assignees = task.task_assignees || [];
      const match = assignees.some((a) => a.employee_id === filterEmployee);
      if (!match) return false;
    }

    // Project filter
    if (filterProject !== "all") {
      const taskProjects = projectMap[task.id];
      if (!taskProjects || !taskProjects.some((p) => p.id === filterProject)) return false;
    }

    // Status filter
    if (filterStatus !== "all" && task.status !== filterStatus) {
      return false;
    }

    // Date From filter
    if (dateFrom) {
      const taskDate = new Date(task.created_at);
      const from = new Date(dateFrom);
      if (taskDate < from) return false;
    }

    // Date To filter
    if (dateTo) {
      const taskDate = new Date(task.created_at);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (taskDate > to) return false;
    }

    return true;
  });

  const clearFilters = () => {
    setFilterContact("all");
    setFilterEmployee("all");
    setFilterProject("all");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task History</h1>
        <p className="text-muted-foreground">
          Complete history of all tasks with filtering.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down the task history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="grid gap-2">
              <Label>Contact</Label>
              <Select value={filterContact} onValueChange={setFilterContact}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {employeeName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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
              {dateFrom && (
                <span className="text-xs text-muted-foreground">{formatDate(dateFrom)}</span>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {dateTo && (
                <span className="text-xs text-muted-foreground">{formatDate(dateTo)}</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            Showing {filteredTasks.length} of {tasks.length} tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    No tasks found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
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
                        const taskProjects = projectMap[task.id];
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
                            <Badge
                              key={a.employee_id}
                              variant="outline"
                              className="text-xs"
                            >
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
                      <Badge
                        variant="secondary"
                        className={`capitalize ${statusColors[task.status] || ""}`}
                      >
                        {task.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(task.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

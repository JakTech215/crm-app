"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchBoardTasks,
  fetchTaskAssignees,
  fetchActiveEmployees,
  fetchAllContacts,
  fetchActiveTaskTypes,
  fetchAllProjects,
  completeTask,
  updateTaskStatus,
  updateTaskPriority,
  createTask,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Diamond,
  ExternalLink,
  Pencil,
  Plus,
  Users,
  User,
  UserCog,
  Loader2,
  Search,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { todayCST, formatDate, nowUTC, isBeforeToday, addDaysToDate } from "@/lib/dates";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface TaskAssignee {
  employee_id: string;
  employees: Employee;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
}

interface TaskType {
  id: string;
  name: string;
  color: string;
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
  is_private: boolean;
  is_recurring: boolean;
  task_type_id: string | null;
  created_at: string;
  task_assignees: TaskAssignee[];
  contacts: ContactOption | null;
}

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

const STATUSES = [
  { key: "pending", label: "Pending", color: "bg-yellow-500" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "blocked", label: "Blocked", color: "bg-red-500" },
  { key: "completed", label: "Completed", color: "bg-green-500" },
  { key: "cancelled", label: "Cancelled", color: "bg-gray-400" },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  blocked: "bg-red-100 text-red-800",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

const priorityBorder: Record<string, string> = {
  low: "border-l-slate-400",
  medium: "border-l-blue-400",
  high: "border-l-orange-400",
  urgent: "border-l-red-500",
};

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

interface ProjectOption {
  id: string;
  name: string;
}

interface BoardColumn {
  id: string;
  label: string;
  sublabel?: string;
  type: "employee" | "contact";
  icon: "employee" | "contact";
}

export default function TaskBoardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // New Task dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createEmployees, setCreateEmployees] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    project_id: "",
    contact_id: "",
    priority: "medium",
    status: "pending",
    start_date: "",
    due_date: "",
    is_milestone: false,
    is_private: false,
  });

  const [statusFilter, setStatusFilter] = useState<string[]>(["pending", "in_progress", "blocked"]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [privacyFilter, setPrivacyFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const fetchData = useCallback(async () => {
    const [taskData, empData, contactData, typeData, projData] = await Promise.all([
      fetchBoardTasks(),
      fetchActiveEmployees(),
      fetchAllContacts(),
      fetchActiveTaskTypes(),
      fetchAllProjects(),
    ]);

    setEmployees(empData);
    setContacts(contactData);
    setTaskTypes(typeData);
    setProjects(projData);

    const taskIds = taskData.map((t) => t.id);
    const assigneeMap = await fetchTaskAssignees(taskIds);

    const tasksWithAssignees = taskData.map((t) => ({
      ...t,
      task_assignees: assigneeMap[t.id] || [],
    }));

    setTasks(tasksWithAssignees as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await completeTask(taskId, nowUTC());
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: "completed" } : null);
      }
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
    setCompleting(null);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const completedAt = newStatus === "completed" ? nowUTC() : undefined;
      await updateTaskStatus(taskId, newStatus, completedAt);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await updateTaskPriority(taskId, newPriority);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, priority: newPriority } : null);
      }
    } catch (e) {
      console.error("Failed to update priority:", e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError(null);

    try {
      await createTask(
        {
          title: createForm.title,
          description: createForm.description || null,
          contact_id: createForm.contact_id || null,
          priority: createForm.priority,
          status: createForm.status,
          start_date: createForm.start_date || null,
          due_date: createForm.due_date || null,
          is_milestone: createForm.is_milestone,
          is_private: createForm.is_private,
        },
        createEmployees,
        createForm.project_id || null,
      );

      // Reset form and refresh
      setCreateForm({
        title: "",
        description: "",
        project_id: "",
        contact_id: "",
        priority: "medium",
        status: "pending",
        start_date: "",
        due_date: "",
        is_milestone: false,
        is_private: false,
      });
      setCreateEmployees([]);
      setCreateOpen(false);
      setCreateSaving(false);
      fetchData();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create task");
      setCreateSaving(false);
    }
  };

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter.length > 0) {
      filtered = filtered.filter((t) => statusFilter.includes(t.status));
    }
    if (priorityFilter.length > 0) {
      filtered = filtered.filter((t) => priorityFilter.includes(t.priority));
    }
    if (taskTypeFilter.length > 0) {
      filtered = filtered.filter((t) => t.task_type_id && taskTypeFilter.includes(t.task_type_id));
    }
    if (dateFrom) {
      filtered = filtered.filter((t) => t.due_date && t.due_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((t) => t.due_date && t.due_date <= dateTo);
    }
    if (privacyFilter === "private") filtered = filtered.filter((t) => t.is_private);
    else if (privacyFilter === "public") filtered = filtered.filter((t) => !t.is_private);

    return filtered;
  }, [tasks, search, statusFilter, priorityFilter, taskTypeFilter, dateFrom, dateTo, privacyFilter]);

  // Build columns: one per employee who has tasks, one per contact who has tasks
  const { columns, tasksByColumn, unassignedTasks } = useMemo(() => {
    const cols: BoardColumn[] = [];
    const colTasks: Record<string, Task[]> = {};
    const assignedTaskIds = new Set<string>();

    // Employee columns — include any employee assigned to at least one filtered task
    for (const emp of employees) {
      const empTasks = filteredTasks.filter((t) =>
        t.task_assignees.some((a) => a.employee_id === emp.id)
      );
      if (empTasks.length > 0) {
        const colId = `emp:${emp.id}`;
        cols.push({
          id: colId,
          label: employeeName(emp),
          type: "employee",
          icon: "employee",
        });
        colTasks[colId] = empTasks;
        empTasks.forEach((t) => assignedTaskIds.add(t.id));
      }
    }

    // Contact columns — include contacts that are assigned to tasks (via contact_id)
    // but only if the task isn't already covered by an employee column
    for (const con of contacts) {
      const conTasks = filteredTasks.filter((t) => t.contact_id === con.id);
      if (conTasks.length > 0) {
        const colId = `con:${con.id}`;
        cols.push({
          id: colId,
          label: contactName(con),
          sublabel: con.company || undefined,
          type: "contact",
          icon: "contact",
        });
        colTasks[colId] = conTasks;
        conTasks.forEach((t) => assignedTaskIds.add(t.id));
      }
    }

    // Tasks with no employee assignee and no contact
    const unassigned = filteredTasks.filter((t) => !assignedTaskIds.has(t.id));

    return { columns: cols, tasksByColumn: colTasks, unassignedTasks: unassigned };
  }, [filteredTasks, employees, contacts]);

  const getTaskType = (typeId: string | null) =>
    typeId ? taskTypes.find((t) => t.id === typeId) : null;

  const renderTaskTile = (task: Task) => {
    const taskType = getTaskType(task.task_type_id);
    const overdue =
      task.due_date &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      isBeforeToday(task.due_date);
    const statusDot = STATUSES.find((s) => s.key === task.status);

    return (
      <div
        key={task.id}
        onClick={() => setSelectedTask(task)}
        className={`group relative bg-background rounded-md border border-l-4 ${
          priorityBorder[task.priority] || "border-l-slate-300"
        } p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2`}
      >
        {/* Title row */}
        <div className="flex items-start gap-1.5">
          {task.is_milestone && (
            <Diamond className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          )}
          {task.is_private && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium leading-tight line-clamp-2">
            {task.title}
          </p>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Task type + status badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {taskType && (
            <Badge
              variant="secondary"
              className={`text-[10px] h-4 px-1.5 ${COLOR_MAP[taskType.color] || ""}`}
            >
              {taskType.name}
            </Badge>
          )}
          {statusDot && (
            <Badge
              variant="secondary"
              className={`text-[10px] h-4 px-1.5 capitalize ${statusColors[task.status] || ""}`}
            >
              {statusDot.label}
            </Badge>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.start_date && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(task.start_date)}
            </span>
          )}
          {task.due_date && (
            <span
              className={`flex items-center gap-1 ${
                overdue ? "text-red-600 font-medium" : ""
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDate(task.due_date)}
              {overdue && " (overdue)"}
            </span>
          )}
        </div>

        {/* Footer: priority + complete */}
        <div className="flex items-center justify-between pt-1">
          <Badge
            variant="outline"
            className={`text-[10px] h-4 px-1.5 capitalize ${priorityColors[task.priority] || ""}`}
          >
            {task.priority}
          </Badge>

          {task.status !== "completed" && task.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
              onClick={(e) => {
                e.stopPropagation();
                handleComplete(task.id);
              }}
              disabled={completing === task.id}
            >
              {completing === task.id ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              )}
              Mark Complete
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Board</h1>
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateTask}>
                <DialogHeader>
                  <DialogTitle>New Task</DialogTitle>
                  <DialogDescription>Create a new task.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {createError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{createError}</div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="create-title">Title *</Label>
                    <Input
                      id="create-title"
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="create-desc">Description</Label>
                    <Textarea
                      id="create-desc"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="create-start">Start Date</Label>
                      <Input
                        id="create-start"
                        type="date"
                        value={createForm.start_date}
                        onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 w-fit"
                        onClick={() => setCreateForm((prev) => ({ ...prev, start_date: todayCST() }))}
                      >
                        Today
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="create-due">Due Date</Label>
                      <Input
                        id="create-due"
                        type="date"
                        value={createForm.due_date}
                        onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "1d", days: 1 },
                          { label: "3d", days: 3 },
                          { label: "1w", days: 7 },
                          { label: "2w", days: 14 },
                          { label: "1m", days: 30 },
                        ].map((q) => (
                          <Button
                            key={q.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              const startStr = createForm.start_date || todayCST();
                              const due = addDaysToDate(startStr, q.days);
                              setCreateForm((prev) => ({
                                ...prev,
                                start_date: prev.start_date || todayCST(),
                                due_date: due,
                              }));
                            }}
                          >
                            {q.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {projects.length > 0 && (
                    <div className="grid gap-2">
                      <Label>Project</Label>
                      <Select
                        value={createForm.project_id || "none"}
                        onValueChange={(v) => setCreateForm({ ...createForm, project_id: v === "none" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {contacts.length > 0 && (
                    <div className="grid gap-2">
                      <Label>Contact</Label>
                      <Select
                        value={createForm.contact_id || "none"}
                        onValueChange={(v) => setCreateForm({ ...createForm, contact_id: v === "none" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No contact</SelectItem>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {contactName(c)}{c.company ? ` (${c.company})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Employees</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" type="button" className="justify-start">
                          <Users className="mr-2 h-4 w-4" />
                          {createEmployees.length > 0 ? `${createEmployees.length} selected` : "Select employees..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        {employees.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-2">No active employees found.</p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {employees.map((emp) => (
                              <label key={emp.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                                <Checkbox
                                  checked={createEmployees.includes(emp.id)}
                                  onCheckedChange={() =>
                                    setCreateEmployees((prev) =>
                                      prev.includes(emp.id) ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                                    )
                                  }
                                />
                                <span className="text-sm">{employeeName(emp)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <Select value={createForm.priority} onValueChange={(v) => setCreateForm({ ...createForm, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={createForm.is_milestone}
                        onCheckedChange={(checked) => setCreateForm({ ...createForm, is_milestone: !!checked })}
                      />
                      <div className="flex items-center gap-1.5">
                        <Diamond className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Mark as milestone</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={createForm.is_private}
                        onCheckedChange={(checked) => setCreateForm({ ...createForm, is_private: !!checked })}
                      />
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Mark as private</span>
                      </div>
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createSaving}>
                    {createSaving ? "Saving..." : "Create Task"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Compact inline filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status checkboxes inline */}
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        {([
          { key: "pending", label: "Pending" },
          { key: "in_progress", label: "In Progress" },
          { key: "blocked", label: "Blocked" },
          { key: "completed", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
        ] as const).map((s) => (
          <label key={s.key} className="flex items-center gap-1 cursor-pointer">
            <Checkbox
              className="h-3.5 w-3.5"
              checked={statusFilter.includes(s.key)}
              onCheckedChange={() => toggleFilter(statusFilter, s.key, setStatusFilter)}
            />
            <span className="text-xs">{s.label}</span>
          </label>
        ))}

        <Separator orientation="vertical" className="h-5" />

        {/* Priority multi-select */}
        <span className="text-xs font-medium text-muted-foreground">Priority</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-7 text-xs px-2.5 font-normal">
              {priorityFilter.length > 0 ? `${priorityFilter.length} selected` : "All"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1.5" align="start">
            {(["low", "medium", "high", "urgent"] as const).map((p) => (
              <label key={p} className="flex items-center gap-2 rounded p-1.5 hover:bg-muted cursor-pointer">
                <Checkbox
                  className="h-3.5 w-3.5"
                  checked={priorityFilter.includes(p)}
                  onCheckedChange={() => toggleFilter(priorityFilter, p, setPriorityFilter)}
                />
                <span className="text-xs capitalize">{p}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {/* Task type multi-select */}
        {taskTypes.length > 0 && (
          <>
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-7 text-xs px-2.5 font-normal">
                  {taskTypeFilter.length > 0 ? `${taskTypeFilter.length} selected` : "All"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5" align="start">
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {taskTypes.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded p-1.5 hover:bg-muted cursor-pointer">
                      <Checkbox
                        className="h-3.5 w-3.5"
                        checked={taskTypeFilter.includes(t.id)}
                        onCheckedChange={() => toggleFilter(taskTypeFilter, t.id, setTaskTypeFilter)}
                      />
                      <span className="text-xs">{t.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

        <Separator orientation="vertical" className="h-5" />

        {/* Privacy */}
        <span className="text-xs font-medium text-muted-foreground">Privacy</span>
        <Select value={privacyFilter} onValueChange={setPrivacyFilter}>
          <SelectTrigger className="h-7 w-32 text-xs px-2.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="private">Private only</SelectItem>
            <SelectItem value="public">Non-private only</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5" />

        {/* Date range */}
        <span className="text-xs font-medium text-muted-foreground">Due From</span>
        <Input
          type="date"
          className="h-7 text-xs w-32 px-2"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="text-xs font-medium text-muted-foreground">Due To</span>
        <Input
          type="date"
          className="h-7 text-xs w-32 px-2"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        {/* Clear all */}
        {(statusFilter.length > 0 || priorityFilter.length > 0 || taskTypeFilter.length > 0 || dateFrom || dateTo || privacyFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              setStatusFilter(["pending", "in_progress", "blocked"]);
              setPriorityFilter([]);
              setTaskTypeFilter([]);
              setDateFrom("");
              setDateTo("");
              setPrivacyFilter("all");
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {columns.length === 0 && unassignedTasks.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          No tasks match the current filters.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = tasksByColumn[col.id] || [];
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-lg"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 p-3 pb-2">
                  {col.icon === "employee" ? (
                    <UserCog className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <User className="h-4 w-4 text-violet-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{col.label}</h3>
                    {col.sublabel && (
                      <p className="text-[11px] text-muted-foreground truncate">{col.sublabel}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                    {colTasks.length}
                  </Badge>
                </div>

                {/* Task tiles */}
                <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)]">
                  {colTasks.map(renderTaskTile)}
                </div>
              </div>
            );
          })}

          {/* Unassigned column */}
          {unassignedTasks.length > 0 && (
            <div className="flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 p-3 pb-2">
                <Users className="h-4 w-4 text-gray-400 shrink-0" />
                <h3 className="text-sm font-semibold text-muted-foreground">Unassigned</h3>
                <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                  {unassignedTasks.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)]">
                {unassignedTasks.map(renderTaskTile)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded task detail dialog */}
      <Dialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
      >
        {selectedTask && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTask.is_milestone && (
                  <Diamond className="h-4 w-4 text-amber-500" />
                )}
                {selectedTask.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Status selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-16">Status</span>
                <Select
                  value={selectedTask.status}
                  onValueChange={(val) => handleStatusChange(selectedTask.id, val)}
                >
                  <SelectTrigger className="w-40 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">Priority</span>
                <Select
                  value={selectedTask.priority}
                  onValueChange={(val) => handlePriorityChange(selectedTask.id, val)}
                >
                  <SelectTrigger className={`w-32 h-8 text-sm capitalize ${priorityColors[selectedTask.priority] || ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="capitalize">{p}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Task type */}
              {(() => {
                const tt = getTaskType(selectedTask.task_type_id);
                return tt ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-16">Type</span>
                    <Badge
                      variant="secondary"
                      className={`${COLOR_MAP[tt.color] || ""}`}
                    >
                      {tt.name}
                    </Badge>
                  </div>
                ) : null;
              })()}

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                {selectedTask.start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(selectedTask.start_date)}
                    </p>
                  </div>
                )}
                {selectedTask.due_date && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                    <p
                      className={`text-sm font-medium flex items-center gap-1.5 ${
                        selectedTask.status !== "completed" &&
                        selectedTask.status !== "cancelled" &&
                        isBeforeToday(selectedTask.due_date)
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(selectedTask.due_date)}
                      {selectedTask.status !== "completed" &&
                        selectedTask.status !== "cancelled" &&
                        isBeforeToday(selectedTask.due_date) &&
                        " (overdue)"}
                    </p>
                  </div>
                )}
              </div>

              {/* Contact */}
              {selectedTask.contacts && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {contactName(selectedTask.contacts)}
                    {selectedTask.contacts.company && (
                      <span className="text-muted-foreground">
                        ({selectedTask.contacts.company})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Assignees */}
              {selectedTask.task_assignees.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTask.task_assignees.map((a) => (
                      <Badge key={a.employee_id} variant="secondary" className="text-xs">
                        {employeeName(a.employees)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(`/dashboard/tasks/${selectedTask.id}`);
                    }}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Full Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(`/dashboard/tasks/${selectedTask.id}?edit=1`);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit Task
                  </Button>
                </div>

                {selectedTask.status !== "completed" &&
                  selectedTask.status !== "cancelled" && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleComplete(selectedTask.id)}
                      disabled={completing === selectedTask.id}
                    >
                      {completing === selectedTask.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      Mark Complete
                    </Button>
                  )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

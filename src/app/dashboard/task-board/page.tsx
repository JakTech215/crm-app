"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Users,
  User,
  Loader2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { todayCST, formatDate, nowUTC, isBeforeToday } from "@/lib/dates";

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

export default function TaskBoardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [
      { data: taskData },
      { data: empData },
      { data: contactData },
      { data: typeData },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, contacts:contact_id(id, first_name, last_name, company)")
        .order("created_at", { ascending: false }),
      supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name"),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company")
        .order("first_name"),
      supabase
        .from("task_types")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name"),
    ]);

    setEmployees(empData || []);
    setContacts(contactData || []);
    setTaskTypes(typeData || []);

    const taskIds = (taskData || []).map((t: { id: string }) => t.id);
    const assigneeMap: Record<string, TaskAssignee[]> = {};

    if (taskIds.length > 0) {
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, employee_id, employees(id, first_name, last_name)")
        .in("task_id", taskIds);

      if (assignees) {
        for (const a of assignees as unknown as (TaskAssignee & { task_id: string })[]) {
          if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
          assigneeMap[a.task_id].push(a);
        }
      }
    }

    const tasksWithAssignees = (taskData || []).map((t: Task) => ({
      ...t,
      task_assignees: assigneeMap[t.id] || [],
    }));

    setTasks(tasksWithAssignees as Task[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: nowUTC() })
      .eq("id", taskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: "completed" } : null);
      }
    }
    setCompleting(null);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completed") {
      updateData.completed_at = nowUTC();
    }
    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId);

    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.description?.toLowerCase().includes(q)
      )
        return false;
    }
    if (filterAssignee !== "all") {
      if (filterAssignee.startsWith("emp:")) {
        const empId = filterAssignee.replace("emp:", "");
        if (!t.task_assignees?.some((a) => a.employee_id === empId)) return false;
      } else if (filterAssignee.startsWith("con:")) {
        const conId = filterAssignee.replace("con:", "");
        if (t.contact_id !== conId) return false;
      }
    }
    return true;
  });

  const tasksByStatus = (status: string) =>
    filteredTasks.filter((t) => t.status === status);

  const getTaskType = (typeId: string | null) =>
    typeId ? taskTypes.find((t) => t.id === typeId) : null;

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
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {employees.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Employees</p>
                  {employees.map((e) => (
                    <SelectItem key={`emp:${e.id}`} value={`emp:${e.id}`}>
                      {employeeName(e)}
                    </SelectItem>
                  ))}
                </>
              )}
              {contacts.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Contacts</p>
                  {contacts.map((c) => (
                    <SelectItem key={`con:${c.id}`} value={`con:${c.id}`}>
                      {contactName(c)}
                      {c.company ? ` (${c.company})` : ""}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((col) => {
          const columnTasks = tasksByStatus(col.key);
          return (
            <div
              key={col.key}
              className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 p-3 pb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                  {columnTasks.length}
                </Badge>
              </div>

              {/* Task tiles */}
              <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px] max-h-[calc(100vh-220px)]">
                {columnTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const taskType = getTaskType(task.task_type_id);
                    const overdue =
                      task.due_date &&
                      task.status !== "completed" &&
                      task.status !== "cancelled" &&
                      isBeforeToday(task.due_date);

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

                        {/* Task type badge */}
                        {taskType && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-4 px-1.5 ${
                              COLOR_MAP[taskType.color] || ""
                            }`}
                          >
                            {taskType.name}
                          </Badge>
                        )}

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

                        {/* Footer: assignees + priority + complete */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1.5 capitalize ${
                                priorityColors[task.priority] || ""
                              }`}
                            >
                              {task.priority}
                            </Badge>
                            {task.contacts && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={contactName(task.contacts)}>
                                <User className="h-3 w-3" />
                              </span>
                            )}
                            {task.task_assignees.length > 0 && (
                              <span
                                className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                                title={task.task_assignees
                                  .map((a) => employeeName(a.employees))
                                  .join(", ")}
                              >
                                <Users className="h-3 w-3" />
                                <span>{task.task_assignees.length}</span>
                              </span>
                            )}
                          </div>

                          {task.status !== "completed" &&
                            task.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Mark as completed"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleComplete(task.id);
                                }}
                                disabled={completing === task.id}
                              >
                                {completing === task.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                <Badge
                  variant="outline"
                  className={`capitalize ${priorityColors[selectedTask.priority] || ""}`}
                >
                  {selectedTask.priority}
                </Badge>
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

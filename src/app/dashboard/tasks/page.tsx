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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, Users, Diamond, Search, Bell } from "lucide-react";

interface Employee {
  id: string;
  name: string;
}

interface TaskAssignee {
  employee_id: string;
  employees: Employee;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

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
  contacts: ContactOption | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  default_due_days: number | null;
  due_amount: number | null;
  due_unit: string | null;
  category: string | null;
}

export default function TasksPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: "",
    contact_id: "",
    priority: "medium",
    status: "pending",
    start_date: "",
    due_date: "",
    is_milestone: false,
    send_notification: false,
  });

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
    const assigneeMap: Record<string, TaskAssignee[]> = {};

    if (taskIds.length > 0) {
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, employee_id, employees(id, name)")
        .in("task_id", taskIds);

      if (assignees) {
        for (const a of assignees as unknown as (TaskAssignee & { task_id: string })[]) {
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
      .select("id, name")
      .eq("status", "active")
      .order("name");
    setEmployees(data || []);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setProjects(data || []);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setContacts(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .order("name");
    setTemplates(data || []);
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchProjects();
    fetchContacts();
    fetchTemplates();
  }, []);

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;

    let dueDate = "";
    const amount = tmpl.due_amount || tmpl.default_due_days;
    const unit = tmpl.due_unit || "days";
    if (amount) {
      const d = new Date();
      if (unit === "hours") d.setHours(d.getHours() + amount);
      else if (unit === "days") d.setDate(d.getDate() + amount);
      else if (unit === "weeks") d.setDate(d.getDate() + amount * 7);
      else if (unit === "months") d.setMonth(d.getMonth() + amount);
      dueDate = d.toISOString().split("T")[0];
    }

    setForm({
      ...form,
      title: form.title || tmpl.name,
      description: form.description || tmpl.description || "",
      priority: tmpl.default_priority,
      due_date: dueDate || form.due_date,
    });
    setSelectedTemplateId(templateId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message || "You must be logged in to create a task.");
      setSaving(false);
      return;
    }

    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: form.title,
        description: form.description || null,
        contact_id: form.contact_id || null,
        priority: form.priority,
        status: form.status,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        is_milestone: form.is_milestone,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (task && selectedEmployees.length > 0) {
      const { error: assignError } = await supabase
        .from("task_assignees")
        .insert(
          selectedEmployees.map((empId) => ({
            task_id: task.id,
            employee_id: empId,
          }))
        );
      if (assignError) {
        setError(
          "Task created but failed to assign employees: " +
            assignError.message
        );
      }
    }

    // Link to project via junction table
    if (task && form.project_id) {
      const { error: projectLinkError } = await supabase
        .from("project_tasks")
        .insert({
          task_id: task.id,
          project_id: form.project_id,
        });
      if (projectLinkError) {
        setError("Task created but failed to link project: " + projectLinkError.message);
        setSaving(false);
        return;
      }
    }

    // Save template_id on the task if a template was used
    if (task && selectedTemplateId) {
      const { error: templateError } = await supabase.from("tasks").update({ template_id: selectedTemplateId }).eq("id", task.id);
      if (templateError) {
        setError("Task created but failed to save template link: " + templateError.message);
      }
    }

    setForm({
      title: "",
      description: "",
      project_id: "",
      contact_id: "",
      priority: "medium",
      status: "pending",
      start_date: "",
      due_date: "",
      is_milestone: false,
      send_notification: false,
    });
    setSelectedTemplateId("");
    setSelectedEmployees([]);
    setOpen(false);
    fetchTasks();
    setSaving(false);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
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
  };

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

  const filterTasks = (filter: string) => {
    let filtered = tasks;
    if (filter === "milestones") filtered = tasks.filter((t) => t.is_milestone);
    else if (filter !== "all") filtered = tasks.filter((t) => t.status === filter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const renderTable = (filteredTasks: Task[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              Loading...
            </TableCell>
          </TableRow>
        ) : filteredTasks.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
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
              <TableCell>
                <div className="flex items-center gap-2">
                  {task.is_milestone && (
                    <Diamond className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <div className="font-medium">
                      {task.title}
                      {task.is_milestone && (
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-amber-100 text-amber-800 text-xs"
                        >
                          Milestone
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {task.description}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {task.contacts ? contactName(task.contacts) : "—"}
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
                        {a.employees?.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
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
                {task.due_date ? (
                  <div>
                    <div className="text-sm">{new Date(task.due_date).toLocaleDateString()}</div>
                    {task.status !== "completed" && (() => {
                      const rel = formatRelativeTime(task.due_date);
                      return <div className={`text-xs ${rel.className}`}>{rel.text}</div>;
                    })()}
                  </div>
                ) : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track your tasks.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>New Task</DialogTitle>
                <DialogDescription>
                  Create a new task to track.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {templates.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Use Template</Label>
                    <Select
                      onValueChange={(value) => applyTemplate(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.category && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {t.category}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {templates.length > 0 && <Separator />}

                <div className="grid gap-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                {projects.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Project{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={form.project_id || "none"}
                      onValueChange={(value) =>
                        setForm({ ...form, project_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {contacts.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Contact{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={form.contact_id || "none"}
                      onValueChange={(value) =>
                        setForm({ ...form, contact_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {contactName(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(value) =>
                        setForm({ ...form, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm({ ...form, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">
                          In Progress
                        </SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="due_date">Due Date & Time</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm({ ...form, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground self-center">Quick set:</span>
                  {[
                    { label: "4h", hours: 4 },
                    { label: "1d", hours: 24 },
                    { label: "3d", hours: 72 },
                    { label: "1w", hours: 168 },
                    { label: "2w", hours: 336 },
                    { label: "1m", hours: 720 },
                  ].map((q) => (
                    <Button
                      key={q.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        const d = new Date();
                        d.setHours(d.getHours() + q.hours);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        setForm({ ...form, due_date: local });
                      }}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label>Assign Employees</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className="justify-start"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {selectedEmployees.length > 0
                          ? `${selectedEmployees.length} selected`
                          : "Select employees..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      {employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">
                          No active employees found.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {employees.map((emp) => (
                            <label
                              key={emp.id}
                              className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={() => toggleEmployee(emp.id)}
                              />
                              <span className="text-sm">{emp.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.is_milestone}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_milestone: !!checked })
                    }
                  />
                  <div className="flex items-center gap-1.5">
                    <Diamond className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      Mark as milestone
                    </span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.send_notification}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, send_notification: !!checked })
                    }
                  />
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Send notification</span>
                  </div>
                </label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="milestones">
            <Diamond className="mr-1.5 h-3 w-3" />
            Milestones
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Complete list of all tasks.</CardDescription>
            </CardHeader>
            <CardContent>{renderTable(filterTasks("all"))}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("pending"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="in_progress">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("in_progress"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="completed">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("completed"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>
                Key milestones across all tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(filterTasks("milestones"))}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

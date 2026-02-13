"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Plus, Trash2, Diamond, Pencil, Users, Bell } from "lucide-react";

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
  parent_task_id: string | null;
  template_id: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  created_at: string;
  task_assignees: TaskAssignee[];
  contacts: ContactOption | null;
}

interface TaskOption {
  id: string;
  title: string;
}

interface DependencyRow {
  id: string;
  dependency_type: string;
  lag_days: number;
  depends_on_task_id: string;
  depends_on_task_title?: string;
}

const DEPENDENCY_TYPES = [
  { value: "finish_to_start", label: "Finish to Start (FS)" },
  { value: "start_to_start", label: "Start to Start (SS)" },
  { value: "finish_to_finish", label: "Finish to Finish (FF)" },
  { value: "start_to_finish", label: "Start to Finish (SF)" },
];

export default function TaskDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [dependencies, setDependencies] = useState<DependencyRow[]>([]);
  const [allTasks, setAllTasks] = useState<TaskOption[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [depOpen, setDepOpen] = useState(false);
  const [savingDep, setSavingDep] = useState(false);
  const [depForm, setDepForm] = useState({
    depends_on_task_id: "",
    dependency_type: "finish_to_start",
    lag_days: "0",
  });

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    contact_id: "",
    priority: "medium",
    status: "pending",
    start_date: "",
    due_date: "",
    is_milestone: false,
    send_notification: false,
  });
  const [editSelectedEmployees, setEditSelectedEmployees] = useState<string[]>([]);

  // Linkages state
  const [linkedProjects, setLinkedProjects] = useState<{ id: string; name: string }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);
  const [editProjectId, setEditProjectId] = useState("");
  const [parentTask, setParentTask] = useState<{ id: string; title: string } | null>(null);
  const [childTasks, setChildTasks] = useState<{ id: string; title: string; status: string }[]>([]);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteCheckOpen, setDeleteCheckOpen] = useState(false);
  const [dependentTasks, setDependentTasks] = useState<{ id: string; title: string }[]>([]);

  const fetchTask = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .eq("id", taskId)
      .single();

    if (error) {
      console.error("Failed to fetch task:", error);
      setFetchError(error.message);
      setLoading(false);
      return;
    }

    // Fetch assignees separately
    let assignees: TaskAssignee[] = [];
    const { data: assigneeData } = await supabase
      .from("task_assignees")
      .select("employee_id, employees(id, name)")
      .eq("task_id", taskId);

    if (assigneeData) {
      assignees = assigneeData as unknown as TaskAssignee[];
    }

    setTask({ ...data, task_assignees: assignees } as Task);
    setLoading(false);
  };

  const fetchDependencies = async () => {
    // Fetch dependencies without join to avoid silent failures
    const { data, error } = await supabase
      .from("task_dependencies")
      .select("id, dependency_type, lag_days, depends_on_task_id")
      .eq("task_id", taskId);

    if (error) {
      console.error("Failed to fetch dependencies:", error);
      setDependencies([]);
      return;
    }

    const deps = data || [];
    if (deps.length === 0) {
      setDependencies([]);
      return;
    }

    // Fetch task titles separately
    const depTaskIds = deps.map((d: { depends_on_task_id: string }) => d.depends_on_task_id);
    const { data: taskData } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", depTaskIds);

    const titleMap: Record<string, string> = {};
    if (taskData) {
      for (const t of taskData) {
        titleMap[t.id] = t.title;
      }
    }

    const depsWithTitles: DependencyRow[] = deps.map((d: DependencyRow) => ({
      ...d,
      depends_on_task_title: titleMap[d.depends_on_task_id] || undefined,
    }));

    setDependencies(depsWithTitles);
  };

  const fetchAllTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title")
      .neq("id", taskId)
      .order("title");
    setAllTasks(data || []);
  };

  const fetchAllEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    setAllEmployees(data || []);
  };

  const fetchAllContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setAllContacts(data || []);
  };

  const fetchAllProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setAllProjects(data || []);
  };

  const fetchLinkedProjects = async () => {
    const { data: links } = await supabase
      .from("project_tasks")
      .select("project_id")
      .eq("task_id", taskId);
    if (links && links.length > 0) {
      const projectIds = links.map((l: { project_id: string }) => l.project_id);
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      setLinkedProjects(projects || []);
    } else {
      setLinkedProjects([]);
    }
  };

  const fetchChildTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("parent_task_id", taskId);
    setChildTasks(data || []);
  };

  useEffect(() => {
    fetchTask();
    fetchDependencies();
    fetchAllTasks();
    fetchAllEmployees();
    fetchAllContacts();
    fetchAllProjects();
    fetchLinkedProjects();
    fetchChildTasks();
  }, [taskId]);

  useEffect(() => {
    if (task?.parent_task_id) {
      supabase
        .from("tasks")
        .select("id, title")
        .eq("id", task.parent_task_id)
        .single()
        .then(({ data }) => setParentTask(data));
    } else {
      setParentTask(null);
    }
  }, [task?.parent_task_id]);

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDep(true);

    const { error } = await supabase.from("task_dependencies").insert({
      task_id: taskId,
      depends_on_task_id: depForm.depends_on_task_id,
      dependency_type: depForm.dependency_type,
      lag_days: parseInt(depForm.lag_days) || 0,
    });

    if (!error) {
      setDepForm({
        depends_on_task_id: "",
        dependency_type: "finish_to_start",
        lag_days: "0",
      });
      setDepOpen(false);
      fetchDependencies();
    }
    setSavingDep(false);
  };

  const handleDeleteDependency = async (depId: string) => {
    await supabase.from("task_dependencies").delete().eq("id", depId);
    fetchDependencies();
  };

  const openEditDialog = () => {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description || "",
      contact_id: task.contact_id || "",
      priority: task.priority,
      status: task.status,
      start_date: task.start_date || "",
      due_date: task.due_date || "",
      is_milestone: task.is_milestone,
      send_notification: false,
    });
    setEditSelectedEmployees(task.task_assignees.map((a) => a.employee_id));
    setEditProjectId(linkedProjects.length > 0 ? linkedProjects[0].id : "");
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editForm.title,
        description: editForm.description || null,
        contact_id: editForm.contact_id || null,
        priority: editForm.priority,
        status: editForm.status,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        is_milestone: editForm.is_milestone,
      })
      .eq("id", taskId);

    if (error) {
      setEditError(error.message);
      setSavingEdit(false);
      return;
    }

    // Update assignees: delete existing, insert new
    const { error: deleteAssigneesError } = await supabase.from("task_assignees").delete().eq("task_id", taskId);
    if (deleteAssigneesError) {
      setEditError("Failed to update assignees: " + deleteAssigneesError.message);
      setSavingEdit(false);
      return;
    }
    if (editSelectedEmployees.length > 0) {
      const { error: insertAssigneesError } = await supabase.from("task_assignees").insert(
        editSelectedEmployees.map((empId) => ({
          task_id: taskId,
          employee_id: empId,
        }))
      );
      if (insertAssigneesError) {
        setEditError("Failed to assign employees: " + insertAssigneesError.message);
        setSavingEdit(false);
        return;
      }
    }

    // Update project link via junction table
    await supabase.from("project_tasks").delete().eq("task_id", taskId);
    if (editProjectId) {
      const { error: projectLinkError } = await supabase.from("project_tasks").insert({
        task_id: taskId,
        project_id: editProjectId,
      });
      if (projectLinkError) {
        setEditError("Failed to link project: " + projectLinkError.message);
        setSavingEdit(false);
        return;
      }
    }

    // Auto-create follow-up task if task was just completed and has a template
    if (editForm.status === "completed" && task && task.status !== "completed" && task.template_id) {
      try {
        const { data: steps } = await supabase
          .from("task_workflow_steps")
          .select("step_order, delay_days, next_template_id")
          .eq("template_id", task.template_id)
          .order("step_order", { ascending: true })
          .limit(1);

        if (steps && steps.length > 0) {
          const step = steps[0];
          // Fetch the next template details
          const { data: nextTemplate } = await supabase
            .from("task_templates")
            .select("id, name, description, default_priority, due_amount, due_unit, default_due_days")
            .eq("id", step.next_template_id)
            .single();

          if (nextTemplate) {
            // Calculate due date
            let dueDate: string | null = null;
            const delayDays = step.delay_days || 0;
            const amount = nextTemplate.due_amount || nextTemplate.default_due_days;
            const unit = nextTemplate.due_unit || "days";
            if (amount) {
              const d = new Date();
              d.setDate(d.getDate() + delayDays);
              if (unit === "hours") d.setHours(d.getHours() + amount);
              else if (unit === "days") d.setDate(d.getDate() + amount);
              else if (unit === "weeks") d.setDate(d.getDate() + amount * 7);
              else if (unit === "months") d.setMonth(d.getMonth() + amount);
              dueDate = d.toISOString().split("T")[0];
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { error: followUpError } = await supabase.from("tasks").insert({
              title: nextTemplate.name,
              description: nextTemplate.description || null,
              priority: nextTemplate.default_priority,
              status: "pending",
              due_date: dueDate,
              contact_id: task.contact_id || null,
              parent_task_id: taskId,
              template_id: nextTemplate.id,
              created_by: user?.id,
            });
            if (followUpError) {
              console.error("Failed to create follow-up task:", followUpError);
            }
          }
        }
      } catch (e) {
        console.error("Failed to create follow-up task:", e);
      }
    }

    setSavingEdit(false);
    setEditOpen(false);
    fetchTask();
    fetchLinkedProjects();
    fetchChildTasks();
  };

  const toggleEditEmployee = (empId: string) => {
    setEditSelectedEmployees((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
  };

  const checkDependenciesAndDelete = async () => {
    // Check what tasks depend on this one
    const { data: deps } = await supabase
      .from("task_dependencies")
      .select("task_id")
      .eq("depends_on_task_id", taskId);

    if (deps && deps.length > 0) {
      const depTaskIds = deps.map((d: { task_id: string }) => d.task_id);
      const { data: depTasks } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", depTaskIds);
      setDependentTasks(depTasks || []);
    } else {
      setDependentTasks([]);
    }
    setDeleteCheckOpen(true);
  };

  const handleDeleteTask = async () => {
    setDeleting(true);

    // Clean up all related records before deleting the task
    const cleanups = [
      supabase.from("task_assignees").delete().eq("task_id", taskId),
      supabase.from("task_dependencies").delete().eq("task_id", taskId),
      supabase.from("task_dependencies").delete().eq("depends_on_task_id", taskId),
      supabase.from("project_tasks").delete().eq("task_id", taskId),
    ];

    const results = await Promise.all(cleanups);
    const cleanupError = results.find((r) => r.error);
    if (cleanupError?.error) {
      setEditError("Failed to clean up related records: " + cleanupError.error.message);
      setDeleting(false);
      setDeleteCheckOpen(false);
      return;
    }

    // Clear parent_task_id on any child/follow-up tasks
    await supabase
      .from("tasks")
      .update({ parent_task_id: null })
      .eq("parent_task_id", taskId);

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      setEditError("Failed to delete task: " + error.message);
      setDeleting(false);
      setDeleteCheckOpen(false);
      return;
    }

    router.push("/dashboard/tasks");
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

  const depTypeLabel = (type: string) =>
    DEPENDENCY_TYPES.find((d) => d.value === type)?.label || type;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!task) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">Task not found.</p>
        {fetchError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Error from Supabase:</p>
            <p>{fetchError}</p>
            <p className="mt-2 text-xs text-muted-foreground">Task ID: {taskId}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
              {task.is_milestone && (
                <Badge className="bg-amber-100 text-amber-800">
                  <Diamond className="mr-1 h-3 w-3" />
                  Milestone
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Task details and dependencies</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={checkDependenciesAndDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <AlertDialog open={deleteCheckOpen} onOpenChange={setDeleteCheckOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete &quot;{task.title}&quot;? This action cannot be undone.
                    </p>
                    {dependentTasks.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Tasks depending on this ({dependentTasks.length}):</p>
                        <ul className="list-disc pl-4 text-sm">
                          {dependentTasks.map((t) => (
                            <li key={t.id}>{t.title}</li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1">These dependency links will be removed.</p>
                      </div>
                    )}
                    {task.task_assignees.length > 0 && (
                      <p className="text-xs">
                        {task.task_assignees.length} employee assignment(s) will also be removed.
                      </p>
                    )}
                    {dependencies.length > 0 && (
                      <p className="text-xs">
                        {dependencies.length} dependency link(s) from this task will be removed.
                      </p>
                    )}
                    {linkedProjects.length > 0 && (
                      <p className="text-xs">
                        Project link(s) to {linkedProjects.map((p) => p.name).join(", ")} will be removed.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTask}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update this task&apos;s details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit_title">Title *</Label>
                <Input
                  id="edit_title"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              {allContacts.length > 0 && (
                <div className="grid gap-2">
                  <Label>
                    Contact{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={editForm.contact_id || "none"}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, contact_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No contact</SelectItem>
                      {allContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {contactName(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {allProjects.length > 0 && (
                <div className="grid gap-2">
                  <Label>
                    Project{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={editProjectId || "none"}
                    onValueChange={(value) =>
                      setEditProjectId(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {allProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, priority: value })
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
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_start_date">Start Date</Label>
                  <Input
                    id="edit_start_date"
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_due_date">Due Date & Time</Label>
                  <Input
                    id="edit_due_date"
                    type="datetime-local"
                    value={editForm.due_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, due_date: e.target.value })
                    }
                  />
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "4h", hours: 4 },
                      { label: "1d", hours: 24 },
                      { label: "3d", hours: 72 },
                      { label: "1w", hours: 168 },
                      { label: "2w", hours: 336 },
                    ].map((q) => (
                      <Button
                        key={q.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(d.getHours() + q.hours);
                          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          setEditForm({ ...editForm, due_date: local });
                        }}
                      >
                        {q.label}
                      </Button>
                    ))}
                  </div>
                </div>
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
                      {editSelectedEmployees.length > 0
                        ? `${editSelectedEmployees.length} selected`
                        : "Select employees..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    {allEmployees.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">
                        No active employees found.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allEmployees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={editSelectedEmployees.includes(emp.id)}
                              onCheckedChange={() => toggleEditEmployee(emp.id)}
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
                  checked={editForm.is_milestone}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_milestone: !!checked })
                  }
                />
                <div className="flex items-center gap-1.5">
                  <Diamond className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Mark as milestone</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editForm.send_notification}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, send_notification: !!checked })
                  }
                />
                <div className="flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Send notification</span>
                </div>
              </label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <p className="mt-1">{task.description}</p>
              </div>
            )}
            {task.contacts && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Contact
                  </p>
                  <p
                    className="mt-1 cursor-pointer text-primary hover:underline"
                    onClick={() => router.push(`/dashboard/contacts/${task.contact_id}`)}
                  >
                    {contactName(task.contacts)}
                  </p>
                </div>
              </>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Priority
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-1 capitalize ${priorityColors[task.priority] || ""}`}
                >
                  {task.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-1 capitalize ${statusColors[task.status] || ""}`}
                >
                  {task.status.replace("_", " ")}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Start Date
                </p>
                <p className="mt-1">{task.start_date || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Due Date
                </p>
                {task.due_date ? (
                  <div className="mt-1">
                    <p>{new Date(task.due_date).toLocaleString()}</p>
                    {task.status !== "completed" && (() => {
                      const due = new Date(task.due_date);
                      const now = new Date();
                      const diffMs = due.getTime() - now.getTime();
                      const absDiffMs = Math.abs(diffMs);
                      const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
                      const days = Math.floor(hours / 24);
                      const isOverdue = diffMs < 0;
                      let text: string;
                      if (days > 30) text = `${Math.floor(days / 30)} month(s)`;
                      else if (days > 0) text = `${days} day(s)`;
                      else if (hours > 0) text = `${hours} hour(s)`;
                      else text = "less than 1 hour";
                      return (
                        <p className={`text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                          {isOverdue ? `Overdue by ${text}` : `Due in ${text}`}
                        </p>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="mt-1">Not set</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Employees</CardTitle>
          </CardHeader>
          <CardContent>
            {task.task_assignees?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {task.task_assignees.map((a) => (
                  <Badge key={a.employee_id} variant="outline">
                    {a.employees?.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No employees assigned.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Dependencies</CardTitle>
            <CardDescription>
              Tasks that must be completed or started relative to this task.
            </CardDescription>
          </div>
          <Dialog open={depOpen} onOpenChange={setDepOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Dependency
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddDependency}>
                <DialogHeader>
                  <DialogTitle>Add Dependency</DialogTitle>
                  <DialogDescription>
                    Select a task this task depends on and configure the
                    relationship.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Depends On Task *</Label>
                    <Select
                      value={depForm.depends_on_task_id}
                      onValueChange={(value) =>
                        setDepForm({ ...depForm, depends_on_task_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a task..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allTasks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Dependency Type *</Label>
                    <Select
                      value={depForm.dependency_type}
                      onValueChange={(value) =>
                        setDepForm({ ...depForm, dependency_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPENDENCY_TYPES.map((dt) => (
                          <SelectItem key={dt.value} value={dt.value}>
                            {dt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lag_days">
                      Lag Days{" "}
                      <span className="text-muted-foreground font-normal">
                        (negative for lead time)
                      </span>
                    </Label>
                    <Input
                      id="lag_days"
                      type="number"
                      value={depForm.lag_days}
                      onChange={(e) =>
                        setDepForm({ ...depForm, lag_days: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={savingDep || !depForm.depends_on_task_id}
                  >
                    {savingDep ? "Saving..." : "Add Dependency"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Depends On</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lag (days)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dependencies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    No dependencies. Click &quot;Add Dependency&quot; to create
                    one.
                  </TableCell>
                </TableRow>
              ) : (
                dependencies.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() =>
                        router.push(
                          `/dashboard/tasks/${dep.depends_on_task_id}`
                        )
                      }
                    >
                      {dep.depends_on_task_title || dep.depends_on_task_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {depTypeLabel(dep.dependency_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dep.lag_days > 0
                        ? `+${dep.lag_days}`
                        : dep.lag_days === 0
                          ? "0"
                          : dep.lag_days}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDependency(dep.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linkages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Projects</p>
            {linkedProjects.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {linkedProjects.map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                  >
                    {p.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No linked projects</p>
            )}
          </div>
          {parentTask && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Parent Task</p>
                <p
                  className="mt-1 cursor-pointer text-primary hover:underline"
                  onClick={() => router.push(`/dashboard/tasks/${parentTask.id}`)}
                >
                  {parentTask.title}
                </p>
              </div>
            </>
          )}
          {childTasks.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Follow-up Tasks</p>
                <div className="space-y-2 mt-1">
                  {childTasks.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/tasks/${ct.id}`)}
                    >
                      <span className="text-sm">{ct.title}</span>
                      <Badge variant="secondary" className={`capitalize ${statusColors[ct.status] || ""}`}>
                        {ct.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

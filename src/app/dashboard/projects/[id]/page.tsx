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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Pencil, Trash2, Plus, Diamond, Search, X } from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

interface Project {
  id: string;
  name: string;
  description: string | null;
  contact_id: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  contacts: Contact | null;
}

interface TaskAssigneeInfo {
  employee_id: string;
  employees: { first_name: string; last_name: string };
}

interface ProjectTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
  is_milestone: boolean;
  contact_id: string | null;
  contacts: { first_name: string; last_name: string | null } | null;
  task_assignees: TaskAssigneeInfo[];
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

const FALLBACK_STATUSES: StatusOption[] = [
  { id: "planning", name: "Planning", color: "blue" },
  { id: "active", name: "Active", color: "green" },
  { id: "on_hold", name: "On Hold", color: "yellow" },
  { id: "completed", name: "Completed", color: "gray" },
];

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

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function ProjectDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<StatusOption[]>(FALLBACK_STATUSES);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Tasks section state
  const [allTasks, setAllTasks] = useState<{ id: string; title: string }[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [taskSortBy, setTaskSortBy] = useState("due_date");
  const [milestoneOnly, setMilestoneOnly] = useState(false);
  const [unlinkTaskId, setUnlinkTaskId] = useState<string | null>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    contact_id: "",
    status: "planning",
    start_date: "",
    due_date: "",
  });

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteCheckOpen, setDeleteCheckOpen] = useState(false);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .eq("id", projectId)
      .single();

    if (error) {
      setFetchError(error.message);
      setLoading(false);
      return;
    }

    setProject(data as Project);
    setLoading(false);
  };

  const fetchTasks = async () => {
    setTasksLoading(true);
    // Get task IDs linked to this project via junction table
    const { data: links } = await supabase
      .from("project_tasks")
      .select("task_id")
      .eq("project_id", projectId);

    if (!links || links.length === 0) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    const taskIds = links.map((l: { task_id: string }) => l.task_id);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, start_date, is_milestone, contact_id, contacts:contact_id(first_name, last_name)")
      .in("id", taskIds)
      .order("due_date", { ascending: true });

    // Fetch assignees for these tasks
    const { data: assignees } = await supabase
      .from("task_assignees")
      .select("task_id, employee_id, employees(first_name, last_name)")
      .in("task_id", taskIds);

    const assigneeMap: Record<string, TaskAssigneeInfo[]> = {};
    if (assignees) {
      for (const a of assignees as unknown as (TaskAssigneeInfo & { task_id: string })[]) {
        if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
        assigneeMap[a.task_id].push(a);
      }
    }

    const enriched: ProjectTask[] = (data || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      title: t.title as string,
      priority: t.priority as string,
      status: t.status as string,
      due_date: t.due_date as string | null,
      start_date: t.start_date as string | null,
      is_milestone: t.is_milestone as boolean,
      contact_id: t.contact_id as string | null,
      contacts: t.contacts as ProjectTask["contacts"],
      task_assignees: assigneeMap[t.id as string] || [],
    }));

    setTasks(enriched);
    setTasksLoading(false);
  };

  const fetchAllTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title")
      .neq("status", "completed")
      .order("title");
    setAllTasks(data || []);
  };

  const handleLinkTask = async (taskId: string) => {
    await supabase.from("project_tasks").insert({ task_id: taskId, project_id: projectId });
    fetchTasks();
    fetchAllTasks();
  };

  const handleUnlinkTask = async (taskId: string) => {
    await supabase.from("project_tasks").delete().eq("task_id", taskId).eq("project_id", projectId);
    setUnlinkTaskId(null);
    fetchTasks();
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setContacts(data || []);
  };

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from("project_statuses")
      .select("id, name, color")
      .order("name");
    if (data && data.length > 0) {
      setProjectStatuses(data);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchContacts();
    fetchStatuses();
    fetchAllTasks();
  }, [projectId]);

  const getStatusColor = (status: string) => {
    const s = projectStatuses.find((ps) => ps.name === status);
    return COLOR_MAP[s?.color || ""] || "";
  };

  const openEditDialog = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      description: project.description || "",
      contact_id: project.contact_id || "",
      status: project.status,
      start_date: project.start_date || "",
      due_date: project.due_date || "",
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    const { error } = await supabase
      .from("projects")
      .update({
        name: editForm.name,
        description: editForm.description || null,
        contact_id: editForm.contact_id || null,
        status: editForm.status,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
      })
      .eq("id", projectId);

    if (error) {
      setEditError(error.message);
      setSavingEdit(false);
      return;
    }

    setSavingEdit(false);
    setEditOpen(false);
    fetchProject();
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Remove task links from junction table
    await supabase
      .from("project_tasks")
      .delete()
      .eq("project_id", projectId);
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (!error) {
      router.push("/dashboard/projects");
    }
    setDeleting(false);
  };

  // Task stats
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      return new Date(t.due_date) < new Date();
    }).length,
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter((t) => {
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== "all" && t.priority !== taskPriorityFilter) return false;
      if (milestoneOnly && !t.is_milestone) return false;
      if (taskSearch) {
        const q = taskSearch.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (taskSortBy === "due_date") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (taskSortBy === "priority") {
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      }
      if (taskSortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

  // Tasks available to link (not already linked to this project)
  const linkedTaskIds = new Set(tasks.map((t) => t.id));
  const availableTasks = allTasks.filter((t) => !linkedTaskIds.has(t.id));

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">Project not found.</p>
        {fetchError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Error:</p>
            <p>{fetchError}</p>
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
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">Project details and linked tasks</p>
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
            onClick={() => setDeleteCheckOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <AlertDialog open={deleteCheckOpen} onOpenChange={setDeleteCheckOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
                    </p>
                    {tasks.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Linked Tasks ({tasks.length}):</p>
                        <ul className="list-disc pl-4 text-sm">
                          {tasks.map((t) => (
                            <li key={t.id}>{t.title}</li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1">These tasks will be unlinked but not deleted.</p>
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update this project&apos;s details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit_name">Project Name *</Label>
                <Input
                  id="edit_name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Link to Contact</Label>
                <Select
                  value={editForm.contact_id || "none"}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, contact_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No contact linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact linked</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {contactName(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStatuses.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_start_date">Start Date</Label>
                  <Input
                    id="edit_start_date"
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_due_date">Due Date</Label>
                  <Input
                    id="edit_due_date"
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-1">{project.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge
                variant="secondary"
                className={`mt-1 capitalize ${getStatusColor(project.status)}`}
              >
                {project.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p className="mt-1">{project.start_date || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Due Date</p>
              <p className="mt-1">{project.due_date || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="mt-1">
                {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
            {project.contacts && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Linked Contact</p>
                <p
                  className="mt-1 text-primary cursor-pointer hover:underline"
                  onClick={() => router.push(`/dashboard/contacts/${project.contacts!.id}`)}
                >
                  {contactName(project.contacts)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Linked Tasks</CardTitle>
            <CardDescription>
              Tasks associated with {project.name}.
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Link Task
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end">
              {availableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No tasks available to link.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {availableTasks.map((t) => (
                    <button
                      key={t.id}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer w-full text-left text-sm"
                      onClick={() => handleLinkTask(t.id)}
                    >
                      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{taskStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{taskStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{taskStats.in_progress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{taskStats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          )}

          {/* Filters */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={taskSortBy} onValueChange={setTaskSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Sort by Due Date</SelectItem>
                  <SelectItem value="priority">Sort by Priority</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={milestoneOnly ? "default" : "outline"}
                size="sm"
                className="h-10"
                onClick={() => setMilestoneOnly(!milestoneOnly)}
              >
                <Diamond className="mr-2 h-4 w-4 text-amber-500" />
                Milestones
              </Button>
            </div>
          )}

          {/* Tasks Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {tasks.length === 0
                      ? "No tasks linked. Click \"Link Task\" to get started."
                      : "No tasks match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date) < new Date();
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <span
                          className="font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                        >
                          <span className="flex items-center gap-2">
                            {task.is_milestone && (
                              <Diamond className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                            {task.title}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.contacts ? (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => router.push(`/dashboard/contacts/${task.contact_id}`)}
                          >
                            {contactName(task.contacts)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
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
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
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
                        <Badge
                          variant="secondary"
                          className={`capitalize ${priorityColors[task.priority] || ""}`}
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.start_date
                          ? new Date(task.start_date).toLocaleDateString()
                          : <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div>
                            <span className={`text-sm ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                            {isOverdue && (
                              <p className="text-xs text-red-600">Overdue</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setUnlinkTaskId(task.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unlink task confirmation */}
      <AlertDialog open={!!unlinkTaskId} onOpenChange={(open) => !open && setUnlinkTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Task</AlertDialogTitle>
            <AlertDialogDescription>
              Unlink &quot;{tasks.find((t) => t.id === unlinkTaskId)?.title}&quot; from {project.name}? This will not delete the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlinkTaskId && handleUnlinkTask(unlinkTaskId)}>
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

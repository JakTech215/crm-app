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
import { ArrowLeft, Pencil, Trash2, Plus, Diamond } from "lucide-react";

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

interface ProjectTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
  is_milestone: boolean;
}

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

  // Task filter state
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");

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
    // Get task IDs linked to this project via junction table
    const { data: links } = await supabase
      .from("project_tasks")
      .select("task_id")
      .eq("project_id", projectId);

    if (!links || links.length === 0) {
      setTasks([]);
      return;
    }

    const taskIds = links.map((l: { task_id: string }) => l.task_id);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, start_date, is_milestone")
      .in("id", taskIds)
      .order("due_date", { ascending: true });
    setTasks(data || []);
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

      <div className="grid gap-6 md:grid-cols-2">
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
            <div className="grid grid-cols-2 gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Linked Tasks</CardTitle>
              <CardDescription>
                Tasks associated with this project ({tasks.length})
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/dashboard/tasks?project=${projectId}`)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks linked to this project yet.
              </p>
            ) : (() => {
              const filteredTasks = tasks.filter(t => taskStatusFilter === "all" || t.status === taskStatusFilter);
              const milestones = filteredTasks.filter(t => t.is_milestone);
              const regularTasks = filteredTasks.filter(t => !t.is_milestone);
              return (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filteredTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tasks match the selected filter.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...milestones, ...regularTasks].map((task) => (
                          <TableRow
                            key={task.id}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell
                              className="font-medium"
                              onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                            >
                              <div className="flex items-center gap-2">
                                {task.is_milestone && (
                                  <>
                                    <Diamond className="h-4 w-4 text-amber-500 shrink-0" />
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                                      Milestone
                                    </Badge>
                                  </>
                                )}
                                <span>{task.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>{task.start_date ? new Date(task.start_date).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`capitalize ${priorityColors[task.priority] || ""}`}
                              >
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={task.status}
                                onValueChange={async (value) => {
                                  await supabase
                                    .from("tasks")
                                    .update({ status: value })
                                    .eq("id", task.id);
                                  fetchTasks();
                                }}
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <Badge
                                    variant="secondary"
                                    className={`capitalize ${statusColors[task.status] || ""}`}
                                  >
                                    {task.status.replace("_", " ")}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

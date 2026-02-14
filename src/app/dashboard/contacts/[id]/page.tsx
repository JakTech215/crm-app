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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  MessageSquare,
  Search,
  X,
  Loader2,
  Check,
} from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  created_at: string;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

interface Note {
  id: string;
  contact_id: string;
  content: string;
  note_type: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskAssigneeInfo {
  employee_id: string;
  employees: { first_name: string; last_name: string };
}

interface ContactTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  task_assignees: TaskAssigneeInfo[];
  projectName: string | null;
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const taskStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  blocked: "bg-red-100 text-red-800",
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

const NOTE_TYPES = [
  { value: "general", label: "General", icon: MessageSquare },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Users },
];

const FALLBACK_STATUSES: StatusOption[] = [
  { id: "active", name: "active", color: "green" },
  { id: "inactive", name: "inactive", color: "gray" },
  { id: "archived", name: "archived", color: "red" },
];

export default function ContactDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [contactTasks, setContactTasks] = useState<ContactTask[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>(FALLBACK_STATUSES);
  const [loading, setLoading] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteForm, setNoteForm] = useState({
    content: "",
    note_type: "general",
  });

  // Edit contact state
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
  });

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteCheckOpen, setDeleteCheckOpen] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState<{ id: string; name: string }[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<{ id: string; title: string }[]>([]);

  // Tasks section state
  const [allTasks, setAllTasks] = useState<{ id: string; title: string }[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [taskSortBy, setTaskSortBy] = useState("due_date");
  const [unlinkTaskId, setUnlinkTaskId] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<Record<string, boolean>>({});
  const [savedField, setSavedField] = useState<Record<string, boolean>>({});
  const [inlineError, setInlineError] = useState<string | null>(null);

  const fetchContact = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();
    setContact(data);
    setLoading(false);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    setNotes(data || []);
  };

  const fetchContactTasks = async () => {
    setTasksLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, priority, start_date, due_date")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });

    const tasks = data || [];
    if (tasks.length === 0) {
      setContactTasks([]);
      setTasksLoading(false);
      return;
    }

    const taskIds = tasks.map((t: { id: string }) => t.id);

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

    // Fetch project links
    const { data: projectLinks } = await supabase
      .from("project_tasks")
      .select("task_id, project_id")
      .in("task_id", taskIds);

    const projectNameMap: Record<string, string> = {};
    if (projectLinks && projectLinks.length > 0) {
      const projectIds = [...new Set(projectLinks.map((pl: { project_id: string }) => pl.project_id))];
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (projects) {
        for (const p of projects) projectNameMap[p.id] = p.name;
      }
    }
    const taskProjectMap: Record<string, string> = {};
    if (projectLinks) {
      for (const pl of projectLinks as { task_id: string; project_id: string }[]) {
        if (projectNameMap[pl.project_id]) taskProjectMap[pl.task_id] = projectNameMap[pl.project_id];
      }
    }

    const enriched: ContactTask[] = tasks.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      title: t.title as string,
      status: t.status as string,
      priority: t.priority as string,
      start_date: t.start_date as string | null,
      due_date: t.due_date as string | null,
      task_assignees: assigneeMap[t.id as string] || [],
      projectName: taskProjectMap[t.id as string] || null,
    }));

    setContactTasks(enriched);
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
    await supabase.from("tasks").update({ contact_id: contactId }).eq("id", taskId);
    fetchContactTasks();
    fetchAllTasks();
  };

  const handleUnlinkTask = async (taskId: string) => {
    await supabase.from("tasks").update({ contact_id: null }).eq("id", taskId);
    setUnlinkTaskId(null);
    fetchContactTasks();
  };

  const handleInlineUpdate = async (taskId: string, field: string, value: string) => {
    const key = `${taskId}-${field}`;
    setSavingField((prev) => ({ ...prev, [key]: true }));
    setSavedField((prev) => ({ ...prev, [key]: false }));
    setInlineError(null);

    const { error } = await supabase
      .from("tasks")
      .update({ [field]: value })
      .eq("id", taskId);

    setSavingField((prev) => ({ ...prev, [key]: false }));

    if (error) {
      setInlineError(`Failed to update ${field}: ${error.message}`);
      return;
    }

    setContactTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
    setSavedField((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavedField((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from("contact_statuses")
      .select("id, name, color")
      .order("name");
    if (data && data.length > 0) {
      setStatuses(data);
    }
  };

  useEffect(() => {
    fetchContact();
    fetchNotes();
    fetchContactTasks();
    fetchStatuses();
    fetchAllTasks();
  }, [contactId]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNote(true);

    if (editingNote) {
      const { error } = await supabase
        .from("notes")
        .update({
          content: noteForm.content,
          note_type: noteForm.note_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingNote.id);

      if (!error) {
        resetNoteForm();
        fetchNotes();
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("notes").insert({
        contact_id: contactId,
        content: noteForm.content,
        note_type: noteForm.note_type,
        author_id: user?.id,
      });

      if (!error) {
        resetNoteForm();
        fetchNotes();
      }
    }
    setSavingNote(false);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteForm({ content: note.content, note_type: note.note_type });
    setNoteOpen(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from("notes").delete().eq("id", noteId);
    fetchNotes();
  };

  const resetNoteForm = () => {
    setNoteForm({ content: "", note_type: "general" });
    setEditingNote(null);
    setNoteOpen(false);
  };

  const openEditDialog = () => {
    if (!contact) return;
    setEditForm({
      first_name: contact.first_name,
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      status: contact.status,
      email_notifications_enabled: contact.email_notifications_enabled ?? true,
      sms_notifications_enabled: contact.sms_notifications_enabled ?? false,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        company: editForm.company || null,
        status: editForm.status || "active",
        email_notifications_enabled: editForm.email_notifications_enabled,
        sms_notifications_enabled: editForm.sms_notifications_enabled,
      })
      .eq("id", contactId);

    if (updateError) {
      setEditError(updateError.message);
      setSavingEdit(false);
      return;
    }

    setEditOpen(false);
    fetchContact();
    setSavingEdit(false);
  };

  const checkDependenciesAndDelete = async () => {
    const [{ data: projects }, { data: tasks }] = await Promise.all([
      supabase.from("projects").select("id, name").eq("contact_id", contactId),
      supabase.from("tasks").select("id, title").eq("contact_id", contactId),
    ]);
    setLinkedProjects(projects || []);
    setLinkedTasks(tasks || []);
    setDeleteCheckOpen(true);
  };

  const handleDeleteContact = async () => {
    setDeleting(true);
    // Unlink projects and tasks, then delete notes and contact
    await Promise.all([
      supabase.from("projects").update({ contact_id: null }).eq("contact_id", contactId),
      supabase.from("tasks").update({ contact_id: null }).eq("contact_id", contactId),
      supabase.from("notes").delete().eq("contact_id", contactId),
    ]);
    const { error } = await supabase.from("contacts").delete().eq("id", contactId);
    if (!error) {
      router.push("/dashboard/contacts");
    }
    setDeleting(false);
  };

  const noteTypeIcon = (type: string) => {
    const nt = NOTE_TYPES.find((n) => n.value === type);
    if (!nt) return <MessageSquare className="h-4 w-4" />;
    const Icon = nt.icon;
    return <Icon className="h-4 w-4" />;
  };

  const noteTypeLabel = (type: string) =>
    NOTE_TYPES.find((n) => n.value === type)?.label || type;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Task stats
  const taskStats = {
    total: contactTasks.length,
    pending: contactTasks.filter((t) => t.status === "pending").length,
    in_progress: contactTasks.filter((t) => t.status === "in_progress").length,
    completed: contactTasks.filter((t) => t.status === "completed").length,
    overdue: contactTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      return new Date(t.due_date) < new Date();
    }).length,
  };

  // Filter and sort tasks
  const filteredContactTasks = contactTasks
    .filter((t) => {
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== "all" && t.priority !== taskPriorityFilter) return false;
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

  // Tasks available to link (not already linked to this contact)
  const linkedTaskIds = new Set(contactTasks.map((t) => t.id));
  const availableTasks = allTasks.filter((t) => !linkedTaskIds.has(t.id));

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!contact) {
    return <div className="p-6">Contact not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{contactName(contact)}</h1>
            <p className="text-muted-foreground">Contact details and notes</p>
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
                <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete &quot;{contactName(contact)}&quot;? This action cannot be undone.
                    </p>
                    {linkedProjects.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Linked Projects ({linkedProjects.length}):</p>
                        <ul className="list-disc pl-4 text-sm">
                          {linkedProjects.map((p) => (
                            <li key={p.id}>{p.name}</li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1">These projects will be unlinked from this contact.</p>
                      </div>
                    )}
                    {linkedTasks.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Linked Tasks ({linkedTasks.length}):</p>
                        <ul className="list-disc pl-4 text-sm">
                          {linkedTasks.map((t) => (
                            <li key={t.id}>{t.title}</li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1">These tasks will be unlinked from this contact.</p>
                      </div>
                    )}
                    <p className="text-xs">All notes for this contact will be permanently deleted.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteContact}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Contact Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>Update this contact&apos;s information.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_last_name">Last Name</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_company">Company</Label>
                <Input
                  id="edit_company"
                  value={editForm.company}
                  onChange={(e) =>
                    setEditForm({ ...editForm, company: e.target.value })
                  }
                />
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
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notification Preferences</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editForm.email_notifications_enabled}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, email_notifications_enabled: !!checked })
                    }
                  />
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Email notifications</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editForm.sms_notifications_enabled}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, sms_notifications_enabled: !!checked })
                    }
                  />
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">SMS notifications</span>
                </label>
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

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-1">{contact.email || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Phone
                  </p>
                  <p className="mt-1">{contact.phone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Company
                  </p>
                  <p className="mt-1">{contact.company || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {contact.status}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="mt-1">{formatDate(contact.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notes</CardTitle>
                <CardDescription>
                  Activity notes for this contact.
                </CardDescription>
              </div>
              <Dialog
                open={noteOpen}
                onOpenChange={(open) => {
                  if (!open) resetNoteForm();
                  else setNoteOpen(true);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSaveNote}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingNote ? "Edit Note" : "New Note"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingNote
                          ? "Update this note."
                          : "Add a new note for this contact."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Type</Label>
                        <Select
                          value={noteForm.note_type}
                          onValueChange={(value) =>
                            setNoteForm({ ...noteForm, note_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NOTE_TYPES.map((nt) => (
                              <SelectItem key={nt.value} value={nt.value}>
                                {nt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="content">Note *</Label>
                        <Textarea
                          id="content"
                          value={noteForm.content}
                          onChange={(e) =>
                            setNoteForm({
                              ...noteForm,
                              content: e.target.value,
                            })
                          }
                          rows={5}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={savingNote}>
                        {savingNote
                          ? "Saving..."
                          : editingNote
                            ? "Update Note"
                            : "Add Note"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No notes yet. Click &quot;New Note&quot; to add one.
                </p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {noteTypeIcon(note.note_type)}
                          <Badge variant="outline" className="capitalize">
                            {noteTypeLabel(note.note_type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.created_at)}
                            {note.updated_at !== note.created_at && " (edited)"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditNote(note)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Linked Tasks Section — always visible, matching employee page pattern */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Linked Tasks</CardTitle>
            <CardDescription>
              Tasks linked to {contactName(contact)}.
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
          {contactTasks.length > 0 && (
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

          {inlineError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {inlineError}
            </div>
          )}

          {/* Filters */}
          {contactTasks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            </div>
          )}

          {/* Tasks Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
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
              ) : filteredContactTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {contactTasks.length === 0
                      ? "No tasks linked. Click \"Link Task\" to get started."
                      : "No tasks match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContactTasks.map((task) => {
                  const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date) < new Date();
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <span
                          className="font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                        >
                          {task.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.projectName || <span className="text-muted-foreground">&mdash;</span>}
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
                        <div className="flex items-center gap-1.5">
                          <Select value={task.status} onValueChange={(v) => handleInlineUpdate(task.id, "status", v)}>
                            <SelectTrigger className={`h-7 w-[130px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${taskStatusColors[task.status] || ""}`}>
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
                          {savingField[`${task.id}-status`] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          {savedField[`${task.id}-status`] && <Check className="h-3 w-3 text-green-600" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
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
                          {savingField[`${task.id}-priority`] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          {savedField[`${task.id}-priority`] && <Check className="h-3 w-3 text-green-600" />}
                        </div>
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
              Unlink &quot;{contactTasks.find((t) => t.id === unlinkTaskId)?.title}&quot; from {contactName(contact)}? This will not delete the task.
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

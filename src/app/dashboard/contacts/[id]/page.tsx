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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  MessageSquare,
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

interface ContactTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

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
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    setContactTasks(data || []);
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
          <TabsTrigger value="tasks">Tasks ({contactTasks.length})</TabsTrigger>
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

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>
                  Tasks linked to this contact.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/tasks?contact=${contactId}`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              {contactTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No tasks linked to this contact yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                      >
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize ${
                              task.priority === "urgent" ? "bg-red-100 text-red-800" :
                              task.priority === "high" ? "bg-orange-100 text-orange-800" :
                              task.priority === "medium" ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize ${
                              task.status === "completed" ? "bg-green-100 text-green-800" :
                              task.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                              "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Plus,
  Loader2,
  Check,
  Calendar,
  X,
  ArrowRight,
} from "lucide-react";

// --- Interfaces ---

interface ContactInfo {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface EventAttendee {
  id: string;
  event_id: string;
  employee_id: string;
  attendance_status: string;
  employees: Employee;
}

interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  event_type: string;
  status: string;
  project_id: string | null;
  contact_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  contacts: ContactInfo | null;
}

interface Note {
  id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string | null;
}

// --- Helpers ---

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

const eventTypeColors: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-800",
  deadline: "bg-red-100 text-red-800",
  milestone: "bg-amber-100 text-amber-800",
  appointment: "bg-green-100 text-green-800",
  other: "bg-gray-100 text-gray-800",
};

const eventStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const attendanceStatusColors: Record<string, string> = {
  invited: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
};

export default function EventDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  // Core data
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);

  // Dropdown data
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);

  // Page state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Inline status update
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    event_date: "",
    event_time: "",
    location: "",
    event_type: "meeting",
    status: "scheduled",
    project_id: "",
    contact_id: "",
  });
  const [editSelectedEmployees, setEditSelectedEmployees] = useState<string[]>([]);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteCheckOpen, setDeleteCheckOpen] = useState(false);

  // Convert to task state
  const [converting, setConverting] = useState(false);

  // --- Data fetching ---

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .eq("id", eventId)
      .single();

    if (error) {
      console.error("Failed to fetch event:", error);
      setFetchError(error.message);
      setLoading(false);
      return;
    }

    setEvent(data as EventRecord);
    setLoading(false);
  };

  const fetchAttendees = async () => {
    const { data } = await supabase
      .from("event_attendees")
      .select("*, employees:employee_id(id, first_name, last_name)")
      .eq("event_id", eventId);

    setAttendees((data as unknown as EventAttendee[]) || []);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("notes_standalone")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    setNotes(data || []);
  };

  const fetchProjectName = async (projectId: string) => {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    setProjectName(data?.name || null);
  };

  const fetchAllEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name");
    setAllEmployees(data || []);
  };

  const fetchAllProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setAllProjects(data || []);
  };

  const fetchAllContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setAllContacts(data || []);
  };

  useEffect(() => {
    fetchEvent();
    fetchAttendees();
    fetchNotes();
    fetchAllEmployees();
    fetchAllProjects();
    fetchAllContacts();
  }, [eventId]);

  useEffect(() => {
    if (event?.project_id) {
      fetchProjectName(event.project_id);
    } else {
      setProjectName(null);
    }
  }, [event?.project_id]);

  // --- Inline status update ---

  const handleInlineStatusUpdate = async (value: string) => {
    if (!event) return;
    setSavingField("status");
    setSavedField(null);

    await supabase.from("events").update({ status: value }).eq("id", event.id);

    setEvent({ ...event, status: value });
    setSavingField(null);
    setSavedField("status");
    setTimeout(() => setSavedField((prev) => (prev === "status" ? null : prev)), 1500);
  };

  // --- Attendee handlers ---

  const handleAddAttendee = async (employeeId: string) => {
    await supabase.from("event_attendees").insert({
      event_id: eventId,
      employee_id: employeeId,
      attendance_status: "invited",
    });
    fetchAttendees();
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    await supabase.from("event_attendees").delete().eq("id", attendeeId);
    fetchAttendees();
  };

  // --- Notes handlers ---

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("notes_standalone").insert({
      content: newNote.trim(),
      event_id: eventId,
      created_by: user?.id || null,
    });

    setNewNote("");
    setSavingNote(false);
    fetchNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from("notes_standalone").delete().eq("id", noteId);
    setDeleteNoteId(null);
    fetchNotes();
  };

  // --- Edit handlers ---

  const openEditDialog = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      description: event.description || "",
      event_date: event.event_date || "",
      event_time: event.event_time || "",
      location: event.location || "",
      event_type: event.event_type || "meeting",
      status: event.status || "scheduled",
      project_id: event.project_id || "",
      contact_id: event.contact_id || "",
    });
    setEditSelectedEmployees(attendees.map((a) => a.employee_id));
    setEditError(null);
    setEditOpen(true);
  };

  const toggleEditEmployee = (empId: string) => {
    setEditSelectedEmployees((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    const { error } = await supabase
      .from("events")
      .update({
        title: editForm.title,
        description: editForm.description || null,
        event_date: editForm.event_date || null,
        event_time: editForm.event_time || null,
        location: editForm.location || null,
        event_type: editForm.event_type,
        status: editForm.status,
        project_id: editForm.project_id || null,
        contact_id: editForm.contact_id || null,
      })
      .eq("id", eventId);

    if (error) {
      setEditError(error.message);
      setSavingEdit(false);
      return;
    }

    // Update attendees: delete existing, insert new
    const { error: deleteAttendeesError } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId);

    if (deleteAttendeesError) {
      setEditError("Failed to update attendees: " + deleteAttendeesError.message);
      setSavingEdit(false);
      return;
    }

    if (editSelectedEmployees.length > 0) {
      const { error: insertAttendeesError } = await supabase
        .from("event_attendees")
        .insert(
          editSelectedEmployees.map((empId) => ({
            event_id: eventId,
            employee_id: empId,
            attendance_status: "invited",
          }))
        );

      if (insertAttendeesError) {
        setEditError("Failed to assign attendees: " + insertAttendeesError.message);
        setSavingEdit(false);
        return;
      }
    }

    setSavingEdit(false);
    setEditOpen(false);
    fetchEvent();
    fetchAttendees();
  };

  // --- Delete handler ---

  const handleDeleteEvent = async () => {
    setDeleting(true);

    // Clean up related records
    await Promise.all([
      supabase.from("event_attendees").delete().eq("event_id", eventId),
      supabase.from("notes_standalone").delete().eq("event_id", eventId),
    ]);

    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) {
      setEditError("Failed to delete event: " + error.message);
      setDeleting(false);
      setDeleteCheckOpen(false);
      return;
    }

    router.push("/dashboard/events");
  };

  // --- Convert to Task handler ---

  const handleConvertToTask = async () => {
    if (!event) return;
    setConverting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: event.title,
        description: event.description || null,
        contact_id: event.contact_id || null,
        status: "pending",
        priority: "medium",
        created_by: user?.id || null,
      })
      .select("id")
      .single();

    if (taskError || !taskData) {
      console.error("Failed to create task:", taskError);
      setConverting(false);
      return;
    }

    // Link to project via project_tasks junction table if event has project_id
    if (event.project_id) {
      await supabase.from("project_tasks").insert({
        task_id: taskData.id,
        project_id: event.project_id,
      });
    }

    setConverting(false);
    router.push(`/dashboard/tasks/${taskData.id}`);
  };

  // --- Render ---

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!event) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">Event not found.</p>
        {fetchError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Error from Supabase:</p>
            <p>{fetchError}</p>
            <p className="mt-2 text-xs text-muted-foreground">Event ID: {eventId}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">{event.title}</h2>
              <Badge className={eventTypeColors[event.event_type] || eventTypeColors.other}>
                {event.event_type}
              </Badge>
            </div>
            <p className="text-muted-foreground">Event details and attendees</p>
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
          <Button
            variant="outline"
            size="sm"
            disabled={converting}
            onClick={handleConvertToTask}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            {converting ? "Converting..." : "Convert to Task"}
          </Button>
        </div>
      </div>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteCheckOpen} onOpenChange={setDeleteCheckOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete &quot;{event.title}&quot;? This action cannot be undone.
                </p>
                {attendees.length > 0 && (
                  <p className="text-xs">
                    {attendees.length} attendee(s) will also be removed.
                  </p>
                )}
                {notes.length > 0 && (
                  <p className="text-xs">
                    {notes.length} note(s) will also be deleted.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>Update this event&apos;s details.</DialogDescription>
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
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_event_date">Event Date</Label>
                  <Input
                    id="edit_event_date"
                    type="date"
                    value={editForm.event_date}
                    onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_event_time">Event Time</Label>
                  <Input
                    id="edit_event_time"
                    type="time"
                    value={editForm.event_time}
                    onChange={(e) => setEditForm({ ...editForm, event_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_location">Location</Label>
                <Input
                  id="edit_location"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Event Type</Label>
                  <Select
                    value={editForm.event_type}
                    onValueChange={(value) => setEditForm({ ...editForm, event_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {allProjects.length > 0 && (
                <div className="grid gap-2">
                  <Label>
                    Project{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={editForm.project_id || "none"}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, project_id: value === "none" ? "" : value })
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
              <div className="grid gap-2">
                <Label>Attendees</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button" className="justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      {editSelectedEmployees.length > 0
                        ? `${editSelectedEmployees.length} selected`
                        : "Select attendees..."}
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
                            <span className="text-sm">{employeeName(emp)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
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

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {event.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-1">{event.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center gap-1 mt-1">
                <Select value={event.status} onValueChange={handleInlineStatusUpdate}>
                  <SelectTrigger
                    className={`h-7 w-[130px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${eventStatusColors[event.status] || ""}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {savingField === "status" && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                {savedField === "status" && (
                  <Check className="h-3 w-3 text-green-600" />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Event Type</p>
              <Badge
                className={`mt-1 capitalize ${eventTypeColors[event.event_type] || eventTypeColors.other}`}
              >
                {event.event_type}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Event Date</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p>
                  {event.event_date
                    ? new Date(event.event_date + "T00:00:00").toLocaleDateString()
                    : "Not set"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Time</p>
              <p className="mt-1">{event.event_time || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <p className="mt-1">{event.location || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Project</p>
              {event.project_id && projectName ? (
                <p
                  className="mt-1 text-blue-600 cursor-pointer hover:underline"
                  onClick={() => router.push(`/dashboard/projects/${event.project_id}`)}
                >
                  {projectName}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">None</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contact</p>
              {event.contacts ? (
                <p
                  className="mt-1 text-blue-600 cursor-pointer hover:underline"
                  onClick={() => router.push(`/dashboard/contacts/${event.contact_id}`)}
                >
                  {contactName(event.contacts)}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">None</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendees Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Attendees{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({attendees.length})
            </span>
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Attendee
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              {(() => {
                const attendeeIds = attendees.map((a) => a.employee_id);
                const available = allEmployees.filter((e) => !attendeeIds.includes(e.id));
                if (available.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground p-2">
                      No more employees to add.
                    </p>
                  );
                }
                return (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {available.map((emp) => (
                      <button
                        key={emp.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer w-full text-left text-sm"
                        onClick={() => handleAddAttendee(emp.id)}
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                        {employeeName(emp)}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          {attendees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attendees.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <Badge variant="outline" className="flex items-center gap-1 pr-1">
                    {a.employees ? employeeName(a.employees) : "Unknown"}
                    <button
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                      onClick={() => handleRemoveAttendee(a.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <Badge
                    className={`text-xs capitalize ${attendanceStatusColors[a.attendance_status] || "bg-gray-100 text-gray-800"}`}
                  >
                    {a.attendance_status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attendees.</p>
          )}
        </CardContent>
      </Card>

      {/* Notes Card */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick-add note */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={savingNote || !newNote.trim()}
              onClick={handleAddNote}
            >
              {savingNote ? "Adding..." : "Add"}
            </Button>
          </div>

          {/* Existing notes */}
          {notes.length > 0 && <Separator />}
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setDeleteNoteId(note.id)}
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleDateString()}{" "}
                {new Date(note.created_at).toLocaleTimeString()}
              </p>
            </div>
          ))}

          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notes yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Note AlertDialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteNoteId && handleDeleteNote(deleteNoteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

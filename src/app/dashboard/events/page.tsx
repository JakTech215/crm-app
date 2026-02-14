"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate as fmtDate, formatTime, nowUTC, isBeforeToday } from "@/lib/dates";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Loader2,
  Check,
  Calendar,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
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

interface EventAttendee {
  employee_id: string;
  employees: Employee;
}

interface EventContact {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  event_type: string;
  status: string;
  project_id: string | null;
  contact_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  contacts: EventContact | null;
  // populated client-side
  attendees: EventAttendee[];
}

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;


// ---------------------------------------------------------------------------
// Default form state
// ---------------------------------------------------------------------------

const defaultForm = {
  title: "",
  description: "",
  event_date: "",
  event_time: "",
  location: "",
  event_type: "meeting",
  status: "scheduled",
  project_id: "",
  contact_id: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventsPage() {
  const supabase = createClient();
  const router = useRouter();

  // Data
  const [events, setEvents] = useState<EventRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Inline status editing
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  // Delete
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchEvents = async () => {
    const { data, error: fetchError } = await supabase
      .from("events")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .order("event_date", { ascending: false });

    if (fetchError) {
      console.error("Failed to fetch events:", fetchError);
      setLoading(false);
      return;
    }

    const rows = (data || []) as EventRow[];
    const eventIds = rows.map((e) => e.id);

    // Fetch attendees separately
    const attendeeMap: Record<string, EventAttendee[]> = {};
    if (eventIds.length > 0) {
      const { data: attendees } = await supabase
        .from("event_attendees")
        .select("event_id, employee_id, employees(id, first_name, last_name)")
        .in("event_id", eventIds);

      if (attendees) {
        for (const a of attendees as unknown as (EventAttendee & { event_id: string })[]) {
          if (!attendeeMap[a.event_id]) attendeeMap[a.event_id] = [];
          attendeeMap[a.event_id].push(a);
        }
      }
    }

    const eventsWithAttendees = rows.map((ev) => ({
      ...ev,
      attendees: attendeeMap[ev.id] || [],
    }));

    setEvents(eventsWithAttendees);
    setLoading(false);
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

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setContacts(data || []);
  };

  useEffect(() => {
    fetchEvents();
    fetchEmployees();
    fetchProjects();
    fetchContacts();
  }, []);

  // -----------------------------------------------------------------------
  // Inline status update
  // -----------------------------------------------------------------------

  const handleInlineStatusUpdate = async (eventId: string, value: string) => {
    const key = `${eventId}-status`;
    setSavingCell(key);
    setSavedCell(null);

    await supabase
      .from("events")
      .update({ status: value, updated_at: nowUTC() })
      .eq("id", eventId);

    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, status: value } : ev))
    );

    setSavingCell(null);
    setSavedCell(key);
    setTimeout(() => setSavedCell((prev) => (prev === key ? null : prev)), 1500);
  };

  // -----------------------------------------------------------------------
  // Create / Edit
  // -----------------------------------------------------------------------

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(defaultForm);
    setSelectedEmployees([]);
    setError(null);
    setOpen(true);
  };

  const openEditDialog = (ev: EventRow) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_date: ev.event_date,
      event_time: ev.event_time || "",
      location: ev.location || "",
      event_type: ev.event_type,
      status: ev.status,
      project_id: ev.project_id || "",
      contact_id: ev.contact_id || "",
    });
    setSelectedEmployees(ev.attendees.map((a) => a.employee_id));
    setError(null);
    setOpen(true);
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
      setError(authError?.message || "You must be logged in.");
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location || null,
      event_type: form.event_type,
      status: form.status,
      project_id: form.project_id || null,
      contact_id: form.contact_id || null,
    };

    if (editingId) {
      // ----- Update -----
      const { error: updateError } = await supabase
        .from("events")
        .update({ ...payload, updated_at: nowUTC() })
        .eq("id", editingId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      // Replace attendees: delete old, insert new
      await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", editingId);

      if (selectedEmployees.length > 0) {
        const { error: attendeeError } = await supabase
          .from("event_attendees")
          .insert(
            selectedEmployees.map((empId) => ({
              event_id: editingId,
              employee_id: empId,
            }))
          );
        if (attendeeError) {
          setError(
            "Event updated but failed to save attendees: " +
              attendeeError.message
          );
        }
      }
    } else {
      // ----- Create -----
      const { data: newEvent, error: insertError } = await supabase
        .from("events")
        .insert({ ...payload, created_by: user.id })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      if (newEvent && selectedEmployees.length > 0) {
        const { error: attendeeError } = await supabase
          .from("event_attendees")
          .insert(
            selectedEmployees.map((empId) => ({
              event_id: newEvent.id,
              employee_id: empId,
            }))
          );
        if (attendeeError) {
          setError(
            "Event created but failed to add attendees: " +
              attendeeError.message
          );
        }
      }
    }

    setForm(defaultForm);
    setSelectedEmployees([]);
    setEditingId(null);
    setOpen(false);
    fetchEvents();
    setSaving(false);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const confirmDelete = async () => {
    if (!deleteEventId) return;
    setDeleteLoading(true);

    await supabase.from("event_attendees").delete().eq("event_id", deleteEventId);
    await supabase.from("events").delete().eq("id", deleteEventId);

    setEvents((prev) => prev.filter((ev) => ev.id !== deleteEventId));
    setDeleteLoading(false);
    setDeleteEventId(null);
  };

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  const filteredEvents = events.filter((ev) => {
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (typeFilter !== "all" && ev.event_type !== typeFilter) return false;
    if (projectFilter !== "all" && ev.project_id !== projectFilter) return false;
    if (contactFilter !== "all" && ev.contact_id !== contactFilter) return false;
    if (
      employeeFilter !== "all" &&
      !ev.attendees.some((a) => a.employee_id === employeeFilter)
    )
      return false;
    if (search) {
      const q = search.toLowerCase();
      if (!ev.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Schedule and manage events, meetings, and milestones.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Event" : "New Event"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update the event details below."
                    : "Create a new event to track."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Title */}
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

                {/* Description */}
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

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="event_date">Event Date *</Label>
                    <Input
                      id="event_date"
                      type="date"
                      value={form.event_date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const updates: Partial<typeof form> = { event_date: newDate };
                        if (newDate && form.status !== "cancelled") {
                          updates.status = isBeforeToday(newDate) ? "completed" : "scheduled";
                        }
                        setForm({ ...form, ...updates });
                      }}
                      required
                    />
                    {form.event_date && (
                      <span className="text-xs text-muted-foreground">{fmtDate(form.event_date)}</span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="event_time">
                      Event Time{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="event_time"
                      type="time"
                      value={form.event_time}
                      onChange={(e) =>
                        setForm({ ...form, event_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </div>

                {/* Type & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Event Type</Label>
                    <Select
                      value={form.event_type}
                      onValueChange={(value) =>
                        setForm({ ...form, event_type: value })
                      }
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
                      value={form.status}
                      onValueChange={(value) =>
                        setForm({ ...form, status: value })
                      }
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

                {/* Project */}
                {projects.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Project{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Select
                      value={form.project_id || "none"}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          project_id: value === "none" ? "" : value,
                        })
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

                {/* Contact */}
                {contacts.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Contact{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Select
                      value={form.contact_id || "none"}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          contact_id: value === "none" ? "" : value,
                        })
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

                {/* Attendees */}
                <div className="grid gap-2">
                  <Label>Attendees</Label>
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
                          : "Select attendees..."}
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
                              <span className="text-sm">
                                {employeeName(emp)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Event"
                    : "Create Event"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="deadline">Deadline</SelectItem>
            <SelectItem value="milestone">Milestone</SelectItem>
            <SelectItem value="appointment">Appointment</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {projects.length > 0 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {contacts.length > 0 && (
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Contacts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {contactName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {employees.length > 0 && (
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {employeeName(emp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteEventId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteEventId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Events
          </CardTitle>
          <CardDescription>
            A list of all events in your CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No events found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((ev) => (
                  <TableRow key={ev.id} className={`hover:bg-muted/50${isBeforeToday(ev.event_date) ? " opacity-70" : ""}`}>
                    {/* Title */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() =>
                            router.push(`/dashboard/events/${ev.id}`)
                          }
                        >
                          {ev.title}
                        </span>
                        {isBeforeToday(ev.event_date) && (
                          <span className="text-xs text-muted-foreground">(past)</span>
                        )}
                      </div>
                      {ev.location && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {ev.location}
                        </div>
                      )}
                    </TableCell>

                    {/* Event Date */}
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(ev.event_date)}
                    </TableCell>

                    {/* Time */}
                    <TableCell className="whitespace-nowrap">
                      {formatTime(ev.event_time) || (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize ${
                          eventTypeColors[ev.event_type] || eventTypeColors.other
                        }`}
                      >
                        {ev.event_type}
                      </Badge>
                    </TableCell>

                    {/* Project */}
                    <TableCell>
                      {ev.project_id ? (
                        <span
                          className="text-blue-600 hover:underline cursor-pointer text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/dashboard/projects/${ev.project_id}`
                            );
                          }}
                        >
                          {projects.find((p) => p.id === ev.project_id)?.name ||
                            "Project"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>

                    {/* Contact */}
                    <TableCell>
                      {ev.contacts ? (
                        <span
                          className="text-blue-600 hover:underline cursor-pointer text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/dashboard/contacts/${ev.contacts!.id}`
                            );
                          }}
                        >
                          {contactName(ev.contacts)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>

                    {/* Employees */}
                    <TableCell>
                      {ev.attendees.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ev.attendees.map((a) => (
                            <Badge
                              key={a.employee_id}
                              variant="outline"
                              className="text-xs"
                            >
                              {a.employees
                                ? employeeName(a.employees)
                                : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>

                    {/* Status - inline editable */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Select
                          value={ev.status}
                          onValueChange={(v) =>
                            handleInlineStatusUpdate(ev.id, v)
                          }
                        >
                          <SelectTrigger
                            className={`h-7 w-[120px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${
                              eventStatusColors[ev.status] ||
                              eventStatusColors.scheduled
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        {savingCell === `${ev.id}-status` && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        {savedCell === `${ev.id}-status` && (
                          <Check className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(ev)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => setDeleteEventId(ev.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

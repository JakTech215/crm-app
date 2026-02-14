"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  X,
  ArrowRight,
  StickyNote,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Note {
  id: string;
  content: string;
  project_id: string | null;
  contact_id: string | null;
  employee_id: string | null;
  task_id: string | null;
  event_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
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

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface TaskOption {
  id: string;
  title: string;
}

interface EventOption {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

const personName = (p: { first_name: string; last_name: string }) =>
  `${p.first_name} ${p.last_name}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotesPage() {
  const supabase = createClient();
  const router = useRouter();

  // Data
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  // Name maps for badge display
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>(
    {}
  );
  const [taskNames, setTaskNames] = useState<Record<string, string>>({});
  const [eventNames, setEventNames] = useState<Record<string, string>>({});

  // Loading / UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick-add form
  const [content, setContent] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formContactId, setFormContactId] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTaskId, setFormTaskId] = useState("");
  const [formEventId, setFormEventId] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterContactId, setFilterContactId] = useState("");
  const [filterUnlinked, setFilterUnlinked] = useState(false);

  // Expand / Delete / Convert
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null);

  // Rapid entry
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("notes_standalone")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch notes:", error);
      setLoading(false);
      return;
    }

    const notesList = (data || []) as Note[];
    setNotes(notesList);

    // Batch-fetch entity names for badge display
    const projectIds = [
      ...new Set(notesList.map((n) => n.project_id).filter(Boolean)),
    ] as string[];
    const contactIds = [
      ...new Set(notesList.map((n) => n.contact_id).filter(Boolean)),
    ] as string[];
    const employeeIds = [
      ...new Set(notesList.map((n) => n.employee_id).filter(Boolean)),
    ] as string[];
    const taskIds = [
      ...new Set(notesList.map((n) => n.task_id).filter(Boolean)),
    ] as string[];
    const eventIds = [
      ...new Set(notesList.map((n) => n.event_id).filter(Boolean)),
    ] as string[];

    if (projectIds.length > 0) {
      const { data: pData } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (pData) {
        const map: Record<string, string> = {};
        for (const p of pData) map[p.id] = p.name;
        setProjectNames(map);
      }
    }

    if (contactIds.length > 0) {
      const { data: cData } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .in("id", contactIds);
      if (cData) {
        const map: Record<string, string> = {};
        for (const c of cData)
          map[c.id] = contactName(c);
        setContactNames(map);
      }
    }

    if (employeeIds.length > 0) {
      const { data: eData } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .in("id", employeeIds);
      if (eData) {
        const map: Record<string, string> = {};
        for (const e of eData) map[e.id] = personName(e);
        setEmployeeNames(map);
      }
    }

    if (taskIds.length > 0) {
      const { data: tData } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", taskIds);
      if (tData) {
        const map: Record<string, string> = {};
        for (const t of tData) map[t.id] = t.title;
        setTaskNames(map);
      }
    }

    if (eventIds.length > 0) {
      const { data: evData } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);
      if (evData) {
        const map: Record<string, string> = {};
        for (const ev of evData) map[ev.id] = ev.title;
        setEventNames(map);
      }
    }

    setLoading(false);
  }, [supabase]);

  const fetchDropdowns = useCallback(async () => {
    const [projectsRes, contactsRes, employeesRes, tasksRes, eventsRes] =
      await Promise.all([
        supabase.from("projects").select("id, name").order("name"),
        supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .order("first_name"),
        supabase
          .from("employees")
          .select("id, first_name, last_name")
          .order("first_name"),
        supabase
          .from("tasks")
          .select("id, title")
          .neq("status", "completed")
          .order("title"),
        supabase.from("events").select("id, title").order("title"),
      ]);

    setProjects(projectsRes.data || []);
    setContacts(contactsRes.data || []);
    setEmployees(employeesRes.data || []);
    setTasks(tasksRes.data || []);
    setEvents(eventsRes.data || []);
  }, [supabase]);

  useEffect(() => {
    fetchNotes();
    fetchDropdowns();
  }, []);

  // Auto-focus textarea on page load
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  // Ctrl+N / Cmd+N global shortcut to focus note entry
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // Success toast helper
  // -------------------------------------------------------------------------

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage((prev) => (prev === msg ? null : prev)), 2000);
  };

  // -------------------------------------------------------------------------
  // Quick-add handler
  // -------------------------------------------------------------------------

  const resetForm = () => {
    setContent("");
    setFormProjectId("");
    setFormContactId("");
    setFormEmployeeId("");
    setFormTaskId("");
    setFormEventId("");
  };

  const handleAddNote = async () => {
    if (!content.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("notes_standalone").insert({
      content: content.trim(),
      project_id: formProjectId || null,
      contact_id: formContactId || null,
      employee_id: formEmployeeId || null,
      task_id: formTaskId || null,
      event_id: formEventId || null,
      created_by: user?.id || null,
    });

    if (error) {
      console.error("Failed to add note:", error);
      setSaving(false);
      return;
    }

    resetForm();
    await fetchNotes();
    setSaving(false);
    showSuccess("Note saved \u2713");
    // Auto-focus back to textarea for rapid entry
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // -------------------------------------------------------------------------
  // Delete handler
  // -------------------------------------------------------------------------

  const confirmDelete = async () => {
    if (!deleteNoteId) return;
    setDeleteLoading(true);

    await supabase.from("notes_standalone").delete().eq("id", deleteNoteId);

    setNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
    setDeleteLoading(false);
    setDeleteNoteId(null);
    showSuccess("Note deleted");
  };

  // -------------------------------------------------------------------------
  // Convert to task handler
  // -------------------------------------------------------------------------

  const handleConvertToTask = async (note: Note) => {
    setConvertingNoteId(note.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const firstLine = note.content.split("\n")[0].slice(0, 100);

    const { data: newTask, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: firstLine,
        description: note.content,
        contact_id: note.contact_id || null,
        status: "pending",
        priority: "medium",
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (taskError || !newTask) {
      console.error("Failed to create task:", taskError);
      setConvertingNoteId(null);
      return;
    }

    // Link to project via junction table if note had a project
    if (note.project_id) {
      await supabase.from("project_tasks").insert({
        task_id: newTask.id,
        project_id: note.project_id,
      });
    }

    // Add employee as task assignee if note had an employee
    if (note.employee_id) {
      await supabase.from("task_assignees").insert({
        task_id: newTask.id,
        employee_id: note.employee_id,
      });
    }

    // Delete the original note
    await supabase.from("notes_standalone").delete().eq("id", note.id);

    setConvertingNoteId(null);
    showSuccess("Note converted to task");
    router.push(`/dashboard/tasks/${newTask.id}`);
  };

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredNotes = notes.filter((note) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      if (!note.content.toLowerCase().includes(q)) return false;
    }

    // Project filter
    if (filterProjectId && note.project_id !== filterProjectId) return false;

    // Contact filter
    if (filterContactId && note.contact_id !== filterContactId) return false;

    // Unlinked filter
    if (filterUnlinked) {
      if (
        note.project_id ||
        note.contact_id ||
        note.employee_id ||
        note.task_id ||
        note.event_id
      )
        return false;
    }

    return true;
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
        <p className="text-muted-foreground">
          Quick capture notes and link them to your CRM entities.
        </p>
      </div>

      {/* Success toast */}
      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center justify-between">
          <span>{successMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setSuccessMessage(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Quick-add card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            Quick Capture
          </CardTitle>
          <CardDescription>
            Jot down a thought and optionally link it to a CRM entity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              ref={textareaRef}
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (content.trim() && !saving) {
                    handleAddNote();
                  }
                }
              }}
              tabIndex={1}
              className="min-h-[100px] text-base resize-y"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Press <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd> to save, <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Shift+Enter</kbd> for new line, <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Ctrl+N</kbd> to focus from anywhere
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* Project */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select
                value={formProjectId || "none"}
                onValueChange={(v) =>
                  setFormProjectId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-xs" tabIndex={3}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contact</Label>
              <Select
                value={formContactId || "none"}
                onValueChange={(v) =>
                  setFormContactId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-xs" tabIndex={4}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Employee</Label>
              <Select
                value={formEmployeeId || "none"}
                onValueChange={(v) =>
                  setFormEmployeeId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-xs" tabIndex={5}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {personName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Task</Label>
              <Select
                value={formTaskId || "none"}
                onValueChange={(v) =>
                  setFormTaskId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-xs" tabIndex={6}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Event</Label>
              <Select
                value={formEventId || "none"}
                onValueChange={(v) =>
                  setFormEventId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-xs" tabIndex={7}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              ref={addButtonRef}
              tabIndex={2}
              onClick={handleAddNote}
              disabled={!content.trim() || saving}
              className={content.trim() ? "ring-2 ring-primary ring-offset-2 transition-all" : "transition-all"}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={filterProjectId || "all"}
          onValueChange={(v) => setFilterProjectId(v === "all" ? "" : v)}
        >
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

        <Select
          value={filterContactId || "all"}
          onValueChange={(v) => setFilterContactId(v === "all" ? "" : v)}
        >
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

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={filterUnlinked}
            onCheckedChange={(checked) => setFilterUnlinked(!!checked)}
          />
          <span className="text-sm text-muted-foreground">Unlinked only</span>
        </label>
      </div>

      {/* Notes card grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading notes...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {notes.length === 0
              ? "No notes yet. Capture your first thought above."
              : "No notes match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => {
            const isExpanded = expandedNoteId === note.id;
            const hasLinks =
              note.project_id ||
              note.contact_id ||
              note.employee_id ||
              note.task_id ||
              note.event_id;

            return (
              <Card key={note.id} className="relative group flex flex-col">
                {/* Action buttons - top right */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-orange-600"
                    disabled={convertingNoteId === note.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConvertToTask(note);
                    }}
                  >
                    {convertingNoteId === note.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        Task
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteNoteId(note.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <CardContent className="pt-5 pb-4 flex flex-col flex-1">
                  {/* Content */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() =>
                      setExpandedNoteId(isExpanded ? null : note.id)
                    }
                  >
                    <p
                      className={`text-sm whitespace-pre-wrap break-words ${
                        isExpanded ? "" : "line-clamp-3"
                      }`}
                    >
                      {note.content}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatRelativeTime(note.created_at)}
                  </p>

                  {/* Linked entity badges */}
                  {hasLinks && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {note.project_id && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/projects/${note.project_id}`
                            )
                          }
                        >
                          {projectNames[note.project_id] || "Project"}
                        </Badge>
                      )}
                      {note.contact_id && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/contacts/${note.contact_id}`
                            )
                          }
                        >
                          {contactNames[note.contact_id] || "Contact"}
                        </Badge>
                      )}
                      {note.employee_id && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/employees/${note.employee_id}`
                            )
                          }
                        >
                          {employeeNames[note.employee_id] || "Employee"}
                        </Badge>
                      )}
                      {note.task_id && (
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer text-xs"
                          onClick={() =>
                            router.push(`/dashboard/tasks/${note.task_id}`)
                          }
                        >
                          {taskNames[note.task_id] || "Task"}
                        </Badge>
                      )}
                      {note.event_id && (
                        <Badge
                          variant="secondary"
                          className="bg-pink-100 text-pink-800 hover:bg-pink-200 cursor-pointer text-xs"
                          onClick={() =>
                            router.push(`/dashboard/events/${note.event_id}`)
                          }
                        >
                          {eventNames[note.event_id] || "Event"}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteNoteId}
        onOpenChange={(open) => {
          if (!open) setDeleteNoteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
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
    </div>
  );
}

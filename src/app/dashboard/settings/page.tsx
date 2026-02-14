"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Mail, MessageSquare, RefreshCw } from "lucide-react";

// ---------- Types ----------

interface StatusItem {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  default_due_days: number | null;
  due_amount: number | null;
  due_unit: string | null;
  send_email_reminder: boolean;
  send_sms_reminder: boolean;
  category: string | null;
  task_type_id: string | null;
  is_recurring: boolean;
  recurrence_frequency: number | null;
  recurrence_unit: string | null;
}

interface TaskType {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

const COLOR_OPTIONS = [
  { value: "gray", label: "Gray", cls: "bg-gray-100 text-gray-800" },
  { value: "red", label: "Red", cls: "bg-red-100 text-red-800" },
  { value: "orange", label: "Orange", cls: "bg-orange-100 text-orange-800" },
  { value: "yellow", label: "Yellow", cls: "bg-yellow-100 text-yellow-800" },
  { value: "green", label: "Green", cls: "bg-green-100 text-green-800" },
  { value: "blue", label: "Blue", cls: "bg-blue-100 text-blue-800" },
  { value: "purple", label: "Purple", cls: "bg-purple-100 text-purple-800" },
  { value: "pink", label: "Pink", cls: "bg-pink-100 text-pink-800" },
];

function colorCls(color: string) {
  return COLOR_OPTIONS.find((c) => c.value === color)?.cls || "bg-gray-100 text-gray-800";
}

// ================================================================
// Contact Statuses Section
// ================================================================

function ContactStatusesSection() {
  const supabase = createClient();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StatusItem | null>(null);
  const [form, setForm] = useState({ name: "", color: "gray", description: "" });
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase
      .from("contact_statuses")
      .select("*")
      .order("name");
    setStatuses(data || []);
  };

  useEffect(() => { fetch(); }, []);

  const resetForm = () => {
    setForm({ name: "", color: "gray", description: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    if (editing) {
      const { error } = await supabase
        .from("contact_statuses")
        .update({ name: form.name, color: form.color, description: form.description || null })
        .eq("id", editing.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("contact_statuses")
        .insert({ name: form.name, color: form.color, description: form.description || null });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    fetch();
  };

  const handleEdit = (s: StatusItem) => {
    setEditing(s);
    setForm({ name: s.name, color: s.color, description: s.description || "" });
    setSaveError(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contact_statuses").delete().eq("id", id);
    if (error) { setSaveError(error.message); return; }
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contact Statuses</CardTitle>
          <CardDescription>Custom statuses for your contacts.</CardDescription>
          {saveError && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive mt-1">{saveError}</div>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Status</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Status" : "New Contact Status"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update this status." : "Create a custom contact status."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="cs-name">Name *</Label>
                  <Input id="cs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded-full ${c.cls.split(" ")[0]}`} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cs-desc">Description</Label>
                  <Input id="cs-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No custom contact statuses yet.</p>
        ) : (
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={colorCls(s.color)}>{s.name}</Badge>
                  {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// Project Statuses Section
// ================================================================

function ProjectStatusesSection() {
  const supabase = createClient();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StatusItem | null>(null);
  const [form, setForm] = useState({ name: "", color: "blue", description: "" });
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase
      .from("project_statuses")
      .select("*")
      .order("name");
    setStatuses(data || []);
  };

  useEffect(() => { fetch(); }, []);

  const resetForm = () => {
    setForm({ name: "", color: "blue", description: "" });
    setEditing(null);
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    if (editing) {
      const { error } = await supabase
        .from("project_statuses")
        .update({ name: form.name, color: form.color, description: form.description || null })
        .eq("id", editing.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("project_statuses")
        .insert({ name: form.name, color: form.color, description: form.description || null });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    fetch();
  };

  const handleEdit = (s: StatusItem) => {
    setEditing(s);
    setForm({ name: s.name, color: s.color, description: s.description || "" });
    setSaveError(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("project_statuses").delete().eq("id", id);
    if (error) { setSaveError(error.message); return; }
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Statuses</CardTitle>
          <CardDescription>Custom statuses for your projects.</CardDescription>
          {saveError && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive mt-1">{saveError}</div>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Status</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Status" : "New Project Status"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update this status." : "Create a custom project status."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="ps-name">Name *</Label>
                  <Input id="ps-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded-full ${c.cls.split(" ")[0]}`} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ps-desc">Description</Label>
                  <Input id="ps-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No custom project statuses yet.</p>
        ) : (
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={colorCls(s.color)}>{s.name}</Badge>
                  {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// Task Types Section
// ================================================================

function TaskTypesSection() {
  const supabase = createClient();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TaskType | null>(null);
  const [form, setForm] = useState({ name: "", color: "gray", is_active: true });
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase
      .from("task_types")
      .select("*")
      .order("name");
    setTaskTypes(data || []);
  };

  useEffect(() => { fetch(); }, []);

  const resetForm = () => {
    setForm({ name: "", color: "gray", is_active: true });
    setEditing(null);
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    if (editing) {
      const { error } = await supabase
        .from("task_types")
        .update({ name: form.name, color: form.color, is_active: form.is_active })
        .eq("id", editing.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("task_types")
        .insert({ name: form.name, color: form.color, is_active: form.is_active });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    fetch();
  };

  const handleEdit = (tt: TaskType) => {
    setEditing(tt);
    setForm({ name: tt.name, color: tt.color, is_active: tt.is_active });
    setSaveError(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("task_types").delete().eq("id", id);
    if (error) { setSaveError(error.message); return; }
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Task Types</CardTitle>
          <CardDescription>Manage task types for categorizing tasks.</CardDescription>
          {saveError && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive mt-1">{saveError}</div>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Task Type</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Task Type" : "New Task Type"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update this task type." : "Create a new task type."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="tt-type-name">Name *</Label>
                  <Input id="tt-type-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded-full ${c.cls.split(" ")[0]}`} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: !!checked })}
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {taskTypes.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No task types yet.</p>
        ) : (
          <div className="space-y-2">
            {taskTypes.map((tt) => (
              <div key={tt.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={colorCls(tt.color)}>{tt.name}</Badge>
                  <span className={`inline-block h-2 w-2 rounded-full ${tt.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                  <span className="text-xs text-muted-foreground">{tt.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tt)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(tt.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// Task Templates Section
// ================================================================

function TaskTemplatesSection() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<Record<string, { next_template_id: string; delay_days: number } | null>>({});
  const [form, setForm] = useState({
    name: "",
    description: "",
    default_priority: "medium",
    due_amount: "",
    due_unit: "days",
    send_email_reminder: false,
    send_sms_reminder: false,
    task_type_id: "",
    is_recurring: false,
    recurrence_frequency: "",
    recurrence_unit: "days",
  });

  const fetch = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .order("name");
    setTemplates(data || []);

    const { data: steps } = await supabase.from("task_workflow_steps").select("template_id, next_template_id, delay_days");
    if (steps) {
      const map: Record<string, { next_template_id: string; delay_days: number } | null> = {};
      for (const s of steps) {
        map[s.template_id] = { next_template_id: s.next_template_id, delay_days: s.delay_days };
      }
      setWorkflowSteps(map);
    }

    const { data: types } = await supabase
      .from("task_types")
      .select("id, name, color, is_active")
      .eq("is_active", true)
      .order("name");
    if (types) setTaskTypes(types);
  };

  useEffect(() => { fetch(); }, []);

  const resetForm = () => {
    setForm({ name: "", description: "", default_priority: "medium", due_amount: "", due_unit: "days", send_email_reminder: false, send_sms_reminder: false, task_type_id: "", is_recurring: false, recurrence_frequency: "", recurrence_unit: "days" });
    setEditing(null);
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const dueAmount = form.due_amount ? parseInt(form.due_amount) : null;
    const payload = {
      name: form.name,
      description: form.description || null,
      default_priority: form.default_priority,
      default_due_days: dueAmount && form.due_unit === "days" ? dueAmount : null,
      due_amount: dueAmount,
      due_unit: dueAmount ? form.due_unit : null,
      send_email_reminder: form.send_email_reminder,
      send_sms_reminder: form.send_sms_reminder,
      task_type_id: form.task_type_id || null,
      is_recurring: form.is_recurring,
      recurrence_frequency: form.is_recurring && form.recurrence_frequency ? parseInt(form.recurrence_frequency) : null,
      recurrence_unit: form.is_recurring && form.recurrence_frequency ? form.recurrence_unit : null,
    };
    if (editing) {
      const { error } = await supabase.from("task_templates").update(payload).eq("id", editing.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("task_templates").insert(payload);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    fetch();
  };

  const handleEdit = (t: TaskTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      default_priority: t.default_priority,
      due_amount: t.due_amount?.toString() || t.default_due_days?.toString() || "",
      due_unit: t.due_unit || "days",
      send_email_reminder: t.send_email_reminder || false,
      send_sms_reminder: t.send_sms_reminder || false,
      task_type_id: t.task_type_id || "",
      is_recurring: t.is_recurring || false,
      recurrence_frequency: t.recurrence_frequency?.toString() || "",
      recurrence_unit: t.recurrence_unit || "days",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("task_templates").delete().eq("id", id);
    if (error) { setSaveError(error.message); return; }
    fetch();
  };

  const priorityColors: Record<string, string> = {
    low: "bg-slate-100 text-slate-800",
    medium: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const buildChain = (startId: string): { name: string; delayDays: number }[] => {
    const chain: { name: string; delayDays: number }[] = [];
    const visited = new Set<string>();
    let currentId = startId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const step = workflowSteps[currentId];
      if (!step || !step.next_template_id) break;
      const nextTmpl = templates.find((t) => t.id === step.next_template_id);
      if (!nextTmpl) break;
      chain.push({ name: nextTmpl.name, delayDays: step.delay_days });
      currentId = step.next_template_id;
    }
    return chain;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Task Templates</CardTitle>
          <CardDescription>Reusable templates for common tasks.</CardDescription>
          {saveError && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive mt-1">{saveError}</div>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Template</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Template" : "New Task Template"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update this template." : "Create a reusable task template."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="tt-name">Template Name *</Label>
                  <Input id="tt-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tt-desc">Description</Label>
                  <Textarea id="tt-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Default Priority</Label>
                  <Select value={form.default_priority} onValueChange={(v) => setForm({ ...form, default_priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tt-due-amount">Due In</Label>
                    <Input id="tt-due-amount" type="number" min="1" placeholder="e.g. 7" value={form.due_amount} onChange={(e) => setForm({ ...form, due_amount: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Select value={form.due_unit} onValueChange={(v) => setForm({ ...form, due_unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reminders</Label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.send_email_reminder}
                      onCheckedChange={(checked) => setForm({ ...form, send_email_reminder: !!checked })}
                    />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Send email reminder</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.send_sms_reminder}
                      onCheckedChange={(checked) => setForm({ ...form, send_sms_reminder: !!checked })}
                    />
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Send SMS reminder</span>
                  </label>
                </div>
                <div className="grid gap-2">
                  <Label>Task Type</Label>
                  <Select value={form.task_type_id || "none"} onValueChange={(v) => setForm({ ...form, task_type_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No type</SelectItem>
                      {taskTypes.map((tt) => (
                        <SelectItem key={tt.id} value={tt.id}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded-full ${colorCls(tt.color).split(" ")[0]}`} />
                            {tt.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.is_recurring}
                      onCheckedChange={(checked) => setForm({ ...form, is_recurring: !!checked })}
                    />
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Recurring task</span>
                  </label>
                  {form.is_recurring && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div className="grid gap-2">
                        <Label htmlFor="tt-rec-freq">Every</Label>
                        <Input id="tt-rec-freq" type="number" min="1" placeholder="e.g. 2" value={form.recurrence_frequency} onChange={(e) => setForm({ ...form, recurrence_frequency: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Unit</Label>
                        <Select value={form.recurrence_unit} onValueChange={(v) => setForm({ ...form, recurrence_unit: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                            <SelectItem value="months">Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No task templates yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge className={priorityColors[t.default_priority] || ""} variant="secondary">
                        {t.default_priority}
                      </Badge>
                      {(() => {
                        const tt = taskTypes.find((x) => x.id === t.task_type_id);
                        return tt ? <Badge className={colorCls(tt.color)}>{tt.name}</Badge> : null;
                      })()}
                      {t.is_recurring && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <RefreshCw className="h-3 w-3" />
                          Every {t.recurrence_frequency} {t.recurrence_unit}
                        </span>
                      )}
                      {t.due_amount && t.due_unit ? (
                        <span className="text-xs text-muted-foreground">{t.due_amount} {t.due_unit}</span>
                      ) : t.default_due_days ? (
                        <span className="text-xs text-muted-foreground">{t.default_due_days} days</span>
                      ) : null}
                      {t.send_email_reminder && (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {t.send_sms_reminder && (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-muted-foreground">Next step:</span>
                  <Select
                    value={workflowSteps[t.id]?.next_template_id || "none"}
                    onValueChange={async (value) => {
                      if (value === "none") {
                        const { error } = await supabase.from("task_workflow_steps").delete().eq("template_id", t.id);
                        if (error) { setSaveError(error.message); return; }
                        setWorkflowSteps({ ...workflowSteps, [t.id]: null });
                      } else {
                        const { error } = await supabase.from("task_workflow_steps").upsert({
                          template_id: t.id,
                          step_order: 1,
                          next_template_id: value,
                          delay_days: workflowSteps[t.id]?.delay_days || 0,
                        }, { onConflict: "template_id,step_order" });
                        if (error) { setSaveError(error.message); return; }
                        setWorkflowSteps({ ...workflowSteps, [t.id]: { next_template_id: value, delay_days: workflowSteps[t.id]?.delay_days || 0 } });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-40">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {templates.filter(tmpl => tmpl.id !== t.id).map(tmpl => (
                        <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">delay:</span>
                  <Input
                    type="number"
                    className="h-7 w-16 text-xs"
                    value={workflowSteps[t.id]?.delay_days ?? 0}
                    onChange={async (e) => {
                      const days = parseInt(e.target.value) || 0;
                      const nextId = workflowSteps[t.id]?.next_template_id;
                      if (nextId) {
                        const { error } = await supabase.from("task_workflow_steps").upsert({
                          template_id: t.id,
                          step_order: 1,
                          next_template_id: nextId,
                          delay_days: days,
                        }, { onConflict: "template_id,step_order" });
                        if (error) { setSaveError(error.message); return; }
                      }
                      setWorkflowSteps({ ...workflowSteps, [t.id]: { next_template_id: nextId || "", delay_days: days } });
                    }}
                  />
                  <span className="text-muted-foreground">days</span>
                </div>
                {(() => {
                  const chain = buildChain(t.id);
                  if (chain.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Badge variant="default" className="text-xs">{t.name}</Badge>
                      {chain.map((step, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{"\u2014"}{step.delayDays}d{"\u2192"}</span>
                          <Badge variant="outline" className="text-xs">{step.name}</Badge>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// Notifications Section (Klaviyo Integration)
// ================================================================

function NotificationsSection() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("klaviyo_api_key") || "" : "";
    setApiKey(stored);
  }, []);

  const templates = [
    { id: "task-assigned", name: "Task Assigned", description: "Sent when a task is assigned to an employee" },
    { id: "task-due-reminder", name: "Task Due Reminder", description: "Sent before a task is due" },
    { id: "task-completed", name: "Task Completed", description: "Sent when a task is marked complete" },
  ];

  const handleSave = () => {
    localStorage.setItem("klaviyo_api_key", apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestSend = (templateId: string) => {
    setTestResult(`Test notification for "${templateId}" queued. Configure Klaviyo API key to enable real sending.`);
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Klaviyo Integration</CardTitle>
          <CardDescription>Connect your Klaviyo account to send task notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="klaviyo-api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="klaviyo-api-key"
                type="password"
                placeholder="pk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button onClick={handleSave}>Save</Button>
            </div>
            {saved && <p className="text-sm text-green-600">Saved!</p>}
          </div>
          <p className="text-sm text-muted-foreground">
            Enter your Klaviyo private API key to enable email and SMS notifications for task events.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Templates</CardTitle>
          <CardDescription>Preview and test notification templates powered by Klaviyo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{tmpl.name}</p>
                <p className="text-sm text-muted-foreground">{tmpl.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleTestSend(tmpl.id)}>
                Test Send
              </Button>
            </div>
          ))}
          {testResult && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================================================================
// Settings Page
// ================================================================

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage statuses, templates, and CRM configuration.
        </p>
      </div>

      <Tabs defaultValue="contact-statuses">
        <TabsList>
          <TabsTrigger value="contact-statuses">Contact Statuses</TabsTrigger>
          <TabsTrigger value="project-statuses">Project Statuses</TabsTrigger>
          <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
          <TabsTrigger value="task-types">Task Types</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="contact-statuses">
          <ContactStatusesSection />
        </TabsContent>
        <TabsContent value="project-statuses">
          <ProjectStatusesSection />
        </TabsContent>
        <TabsContent value="task-templates">
          <TaskTemplatesSection />
        </TabsContent>
        <TabsContent value="task-types">
          <TaskTypesSection />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

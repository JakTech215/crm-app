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
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Mail, MessageSquare, RefreshCw, ChevronDown, ChevronUp, Shield, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nowCST, formatDate } from "@/lib/dates";

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
  recurrence_count: number | null;
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
  const [workflowSteps, setWorkflowSteps] = useState<
    Record<string, { step_order: number; next_template_id: string; delay_days: number; trigger_condition: string }[]>
  >({});
  const [formSteps, setFormSteps] = useState<
    { next_template_id: string; delay_days: number; trigger_condition: string }[]
  >([]);
  const [recurringExpanded, setRecurringExpanded] = useState(false);
  const [chainExpanded, setChainExpanded] = useState(false);
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
    recurrence_count: "",
  });

  const fetchData = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .order("name");
    setTemplates(data || []);

    const { data: steps } = await supabase
      .from("task_workflow_steps")
      .select("*")
      .order("step_order");
    if (steps) {
      const map: Record<string, { step_order: number; next_template_id: string; delay_days: number; trigger_condition: string }[]> = {};
      for (const s of steps as { template_id: string; step_order: number; next_template_id: string; delay_days: number; trigger_condition?: string }[]) {
        if (!map[s.template_id]) map[s.template_id] = [];
        map[s.template_id].push({
          step_order: s.step_order,
          next_template_id: s.next_template_id,
          delay_days: s.delay_days,
          trigger_condition: s.trigger_condition || "on_completion",
        });
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

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ name: "", description: "", default_priority: "medium", due_amount: "", due_unit: "days", send_email_reminder: false, send_sms_reminder: false, task_type_id: "", is_recurring: false, recurrence_frequency: "", recurrence_unit: "days", recurrence_count: "" });
    setFormSteps([]);
    setRecurringExpanded(false);
    setChainExpanded(false);
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
      recurrence_count: form.is_recurring && form.recurrence_count ? parseInt(form.recurrence_count) : null,
    };

    let templateId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("task_templates").update(payload).eq("id", editing.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { data: inserted, error } = await supabase.from("task_templates").insert(payload).select("id").single();
      if (error) { setSaveError(error.message); setSaving(false); return; }
      templateId = inserted.id;
    }

    // Save workflow steps
    if (templateId) {
      await supabase.from("task_workflow_steps").delete().eq("template_id", templateId);
      const validSteps = formSteps.filter((s) => s.next_template_id);
      if (validSteps.length > 0) {
        const stepRows = validSteps.map((s, i) => ({
          template_id: templateId as string,
          step_order: i + 1,
          next_template_id: s.next_template_id,
          delay_days: s.delay_days,
          trigger_condition: s.trigger_condition,
        }));
        const { error: stepError } = await supabase.from("task_workflow_steps").insert(stepRows);
        if (stepError) { setSaveError(stepError.message); setSaving(false); return; }
      }
    }

    setSaving(false);
    resetForm();
    fetchData();
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
      recurrence_count: t.recurrence_count?.toString() || "",
    });
    const steps = workflowSteps[t.id] || [];
    setFormSteps(steps.map((s) => ({
      next_template_id: s.next_template_id,
      delay_days: s.delay_days,
      trigger_condition: s.trigger_condition,
    })));
    setRecurringExpanded(t.is_recurring || false);
    setChainExpanded(steps.length > 0);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("task_workflow_steps").delete().eq("template_id", id);
    const { error } = await supabase.from("task_templates").delete().eq("id", id);
    if (error) { setSaveError(error.message); return; }
    fetchData();
  };

  const priorityColors: Record<string, string> = {
    low: "bg-slate-100 text-slate-800",
    medium: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const buildChain = (startId: string): { name: string; delayDays: number; trigger: string }[] => {
    const chain: { name: string; delayDays: number; trigger: string }[] = [];
    const visited = new Set<string>();
    let currentId = startId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const steps = workflowSteps[currentId];
      if (!steps || steps.length === 0) break;
      const step = steps[0];
      const nextTmpl = templates.find((t) => t.id === step.next_template_id);
      if (!nextTmpl) break;
      chain.push({ name: nextTmpl.name, delayDays: step.delay_days, trigger: step.trigger_condition });
      currentId = step.next_template_id;
    }
    return chain;
  };

  const triggerLabel = (trigger: string) => {
    switch (trigger) {
      case "on_completion": return "On Completion";
      case "after_days_from_start": return "After Days from Start";
      case "on_due_date": return "On Due Date";
      default: return trigger;
    }
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
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Template" : "New Task Template"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update this template." : "Create a reusable task template."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Template Name */}
                <div className="grid gap-2">
                  <Label htmlFor="tt-name">Template Name *</Label>
                  <Input id="tt-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>

                {/* Description */}
                <div className="grid gap-2">
                  <Label htmlFor="tt-desc">Description</Label>
                  <Textarea id="tt-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                {/* Task Type */}
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

                {/* Default Priority */}
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

                {/* Default Due */}
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

                <Separator />

                {/* Recurring Task Settings — collapsible */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setRecurringExpanded(!recurringExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Recurring Task Settings</span>
                      {form.is_recurring && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                    </div>
                    {recurringExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {recurringExpanded && (
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.is_recurring}
                          onCheckedChange={(checked) => setForm({ ...form, is_recurring: !!checked })}
                        />
                        <span className="text-sm">Enable recurring task</span>
                      </label>
                      {form.is_recurring && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
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
                          <div className="grid gap-2">
                            <Label htmlFor="tt-rec-count">Number of Occurrences</Label>
                            <Input id="tt-rec-count" type="number" min="1" max="100" placeholder="e.g. 5" value={form.recurrence_count} onChange={(e) => setForm({ ...form, recurrence_count: e.target.value })} />
                            {form.recurrence_count && parseInt(form.recurrence_count) > 0 && (
                              <p className="text-xs text-muted-foreground">Create {form.recurrence_count} task{parseInt(form.recurrence_count) !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                          {form.recurrence_frequency && parseInt(form.recurrence_frequency) > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Preview occurrences:</p>
                              {(() => {
                                const freq = parseInt(form.recurrence_frequency);
                                const unit = form.recurrence_unit;
                                const dueAmount = form.due_amount ? parseInt(form.due_amount) : 0;
                                const dueUnit = form.due_unit;
                                const dates: string[] = [];
                                const count = form.recurrence_count ? parseInt(form.recurrence_count) : 5;
                                for (let i = 0; i < count; i++) {
                                  const d = nowCST();
                                  if (dueAmount) {
                                    if (dueUnit === "hours") d.setHours(d.getHours() + dueAmount);
                                    else if (dueUnit === "days") d.setDate(d.getDate() + dueAmount);
                                    else if (dueUnit === "weeks") d.setDate(d.getDate() + dueAmount * 7);
                                    else if (dueUnit === "months") d.setMonth(d.getMonth() + dueAmount);
                                  }
                                  if (i > 0) {
                                    const offset = freq * i;
                                    if (unit === "days") d.setDate(d.getDate() + offset);
                                    else if (unit === "weeks") d.setDate(d.getDate() + offset * 7);
                                    else if (unit === "months") d.setMonth(d.getMonth() + offset);
                                  }
                                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                  dates.push(formatDate(dateStr));
                                }
                                return dates.map((date, i) => (
                                  <p key={i} className="text-xs text-muted-foreground pl-2">{i + 1}. {date}</p>
                                ));
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Workflow Chain — collapsible */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setChainExpanded(!chainExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Workflow Chain</span>
                      {formSteps.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{formSteps.length} step{formSteps.length !== 1 ? "s" : ""}</Badge>
                      )}
                    </div>
                    {chainExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {chainExpanded && (
                    <div className="space-y-3 pt-2">
                      {formSteps.length === 0 && (
                        <p className="text-xs text-muted-foreground">No follow-up steps configured.</p>
                      )}
                      {formSteps.map((step, idx) => (
                        <div key={idx} className="rounded border p-3 space-y-2 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Step {idx + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs">Follow-up Template</Label>
                            <Select
                              value={step.next_template_id || "none"}
                              onValueChange={(v) => {
                                const updated = [...formSteps];
                                updated[idx] = { ...updated[idx], next_template_id: v === "none" ? "" : v };
                                setFormSteps(updated);
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {templates.filter((tmpl) => tmpl.id !== editing?.id).map((tmpl) => (
                                  <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                              <Label className="text-xs">Trigger</Label>
                              <Select
                                value={step.trigger_condition}
                                onValueChange={(v) => {
                                  const updated = [...formSteps];
                                  updated[idx] = { ...updated[idx], trigger_condition: v };
                                  setFormSteps(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_completion">On Completion</SelectItem>
                                  <SelectItem value="after_days_from_start">After X Days from Start</SelectItem>
                                  <SelectItem value="on_due_date">On Due Date</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-xs">Delay (days)</Label>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 text-sm"
                                value={step.delay_days}
                                onChange={(e) => {
                                  const updated = [...formSteps];
                                  updated[idx] = { ...updated[idx], delay_days: parseInt(e.target.value) || 0 };
                                  setFormSteps(updated);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setFormSteps([...formSteps, { next_template_id: "", delay_days: 0, trigger_condition: "on_completion" }])}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add Follow-up Template
                      </Button>
                      {formSteps.filter((s) => s.next_template_id).length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Chain Preview:</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="default" className="text-xs">{form.name || "This Template"}</Badge>
                            {formSteps.filter((s) => s.next_template_id).map((step, i) => {
                              const tmpl = templates.find((t) => t.id === step.next_template_id);
                              return (
                                <span key={i} className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {"\u2014"}{step.delay_days}d ({triggerLabel(step.trigger_condition)}){"\u2192"}
                                  </span>
                                  <Badge variant="outline" className="text-xs">{tmpl?.name || "Unknown"}</Badge>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Reminders */}
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
                          Every {t.recurrence_frequency} {t.recurrence_unit}{t.recurrence_count ? ` × ${t.recurrence_count}` : ""}
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
                      {(workflowSteps[t.id]?.length || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">{workflowSteps[t.id].length} follow-up{workflowSteps[t.id].length !== 1 ? "s" : ""}</Badge>
                      )}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
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
// User Management Section (Admin Only)
// ================================================================

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

function UserManagementSection() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "user" });

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCheckingRole(false); return; }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(profile?.role === "admin");
    setCheckingRole(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // Non-admin will get 403
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to invite user");
        setSaving(false);
        return;
      }
      setSuccess(`Invitation sent to ${form.email}`);
      setForm({ email: "", full_name: "", role: "user" });
      setOpen(false);
      fetchUsers();
    } catch {
      setError("Failed to invite user");
    }
    setSaving(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role: newRole }),
    });
    if (res.ok) fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId }),
    });
    if (res.ok) fetchUsers();
  };

  if (checkingRole) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Checking permissions...</CardContent></Card>;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            Only administrators can manage users. Contact your administrator for access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Invite and manage user accounts. Users receive an email to set their password.</CardDescription>
          {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive mt-2">{error}</div>}
          {success && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700 mt-2">{success}</div>}
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm({ email: "", full_name: "", role: "user" }); setError(null); } setOpen(o); }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
                <DialogDescription>
                  Send an invitation email. The user will set their own password.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-email">Email *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admin: Full access including user management. User: Standard access. Viewer: Read-only.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users found. Click &quot;Invite User&quot; to add the first user.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.full_name || "\u2014"}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                      <SelectTrigger className="h-7 w-24 border-0 shadow-none capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {u.email} and revoke their access. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(u.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
          <TabsTrigger value="users">User Management</TabsTrigger>
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
        <TabsContent value="users">
          <UserManagementSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

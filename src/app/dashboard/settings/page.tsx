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
import { Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp, Shield, UserPlus, Download } from "lucide-react";
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
    setForm({ name: "", description: "", default_priority: "medium", due_amount: "", due_unit: "days", task_type_id: "", is_recurring: false, recurrence_frequency: "", recurrence_unit: "days", recurrence_count: "" });
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
// Holidays Management Section
// ================================================================

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  holiday_type: string;
  description: string | null;
  is_recurring: boolean;
  created_at: string;
}

const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  federal: "bg-blue-100 text-blue-800",
  company: "bg-purple-100 text-purple-800",
  personal: "bg-green-100 text-green-800",
  religious: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-800",
};

const API_BASE = "https://date.nager.at/api/v3/publicholidays";

function HolidaysSection() {
  const supabase = createClient();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    holiday_date: "",
    holiday_type: "company",
    is_recurring: false,
    description: "",
  });

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from("holidays")
      .select("*")
      .order("holiday_date", { ascending: true });
    setHolidays((data as Holiday[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const year = new Date().getFullYear();
      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE}/${year}/US`),
        fetch(`${API_BASE}/${year + 1}/US`),
      ]);
      if (!res1.ok || !res2.ok) throw new Error("API request failed");
      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
      const all = [...data1, ...data2].filter(
        (h: { types: string[] }) => h.types.includes("Public")
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let count = 0;
      for (const h of all as { date: string; localName: string; name: string }[]) {
        const { error } = await supabase.from("holidays").upsert(
          {
            name: h.localName || h.name,
            holiday_date: h.date,
            holiday_type: "federal",
            is_recurring: true,
            created_by: user?.id,
          },
          { onConflict: "holiday_date,name" }
        );
        if (!error) count++;
      }

      setSyncMessage({
        text: `Imported ${count} federal holidays for ${year}–${year + 1}`,
        type: "success",
      });
      fetchHolidays();
    } catch {
      setSyncMessage({ text: "Failed to sync holidays. Please try again.", type: "error" });
    }
    setSyncing(false);
  };

  const resetForm = () => {
    setForm({ name: "", holiday_date: "", holiday_type: "company", is_recurring: false, description: "" });
    setEditing(null);
    setSaveError(null);
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (editing) {
      const { error } = await supabase
        .from("holidays")
        .update({
          name: form.name,
          holiday_date: form.holiday_date,
          holiday_type: form.holiday_type,
          is_recurring: form.is_recurring,
          description: form.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("holidays").insert({
        name: form.name,
        holiday_date: form.holiday_date,
        holiday_type: form.holiday_type,
        is_recurring: form.is_recurring,
        description: form.description || null,
        created_by: user?.id,
      });
      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    resetForm();
    fetchHolidays();
  };

  const handleEdit = (h: Holiday) => {
    setEditing(h);
    setForm({
      name: h.name,
      holiday_date: h.holiday_date,
      holiday_type: h.holiday_type,
      is_recurring: h.is_recurring,
      description: h.description || "",
    });
    setSaveError(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("holidays").delete().eq("id", id);
    fetchHolidays();
  };

  const filtered = holidays.filter((h) => {
    if (filter === "all") return true;
    return h.holiday_type === filter;
  });

  return (
    <div className="space-y-6">
      {/* Sync Federal Holidays */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Sync Federal Holidays
              </CardTitle>
              <CardDescription>
                Import US federal holidays from the public API for the current and next year.
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync US Federal Holidays"}
            </Button>
          </div>
          {syncMessage && (
            <div
              className={`mt-3 rounded-md p-3 text-sm ${
                syncMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {syncMessage.text}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Holiday List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Holidays</CardTitle>
            <CardDescription>
              {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} total
              {holidays.filter((h) => h.holiday_type === "federal").length > 0 &&
                ` (${holidays.filter((h) => h.holiday_type === "federal").length} federal)`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="federal">Federal</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="religious">Religious</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Dialog
              open={open}
              onOpenChange={(o) => {
                if (!o) resetForm();
                else setOpen(true);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSave}>
                  <DialogHeader>
                    <DialogTitle>{editing ? "Edit Holiday" : "Add Custom Holiday"}</DialogTitle>
                    <DialogDescription>
                      {editing
                        ? "Update the holiday details."
                        : "Add a custom company, personal, or religious holiday."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {saveError && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {saveError}
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="h-name">Name *</Label>
                      <Input
                        id="h-name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        placeholder="e.g. Company Retreat Day"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="h-date">Date *</Label>
                      <Input
                        id="h-date"
                        type="date"
                        value={form.holiday_date}
                        onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
                        required
                      />
                      {form.holiday_date && (
                        <span className="text-xs text-muted-foreground">{formatDate(form.holiday_date)}</span>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="h-type">Type</Label>
                      <Select
                        value={form.holiday_type}
                        onValueChange={(v) => setForm({ ...form, holiday_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">Company</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="religious">Religious</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="h-desc">Description</Label>
                      <Textarea
                        id="h-desc"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Optional notes about this holiday"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="h-recurring"
                        checked={form.is_recurring}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, is_recurring: !!checked })
                        }
                      />
                      <Label htmlFor="h-recurring" className="font-normal">
                        Repeats yearly
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : editing ? "Save Changes" : "Add Holiday"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading holidays...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === "all"
                ? 'No holidays yet. Click "Sync US Federal Holidays" or "Add Custom Holiday" to get started.'
                : `No ${filter} holidays found.`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{formatDate(h.holiday_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize ${HOLIDAY_TYPE_COLORS[h.holiday_type] || ""}`}
                      >
                        {h.holiday_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {h.is_recurring ? (
                        <Badge variant="outline" className="text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Yearly
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">One-time</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {h.description || "—"}
                    </TableCell>
                    <TableCell>
                      {h.holiday_type !== "federal" ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(h)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete &quot;{h.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(h.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Imported
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
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

        <TabsContent value="users">
          <UserManagementSection />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

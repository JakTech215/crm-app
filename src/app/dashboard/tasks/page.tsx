"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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
import { Plus, Users, Diamond, Search, RefreshCw, Loader2, Check, Trash2 } from "lucide-react";
import { todayCST, formatDate, formatDateLong, formatRelativeTime as formatRelativeTimeUtil, nowUTC, isBeforeToday, addDaysToDate } from "@/lib/dates";
import { FilterPanel, FilterDef, FilterValues, defaultFilterValues } from "@/components/filter-panel";

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

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

interface TaskAssignee {
  employee_id: string;
  employees: Employee;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

const contactDisplay = (c: { first_name: string; last_name: string | null; company?: string | null }) =>
  `${contactName(c)}${c.company ? ` (${c.company})` : ""}`;

interface Task {
  id: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  is_recurring: boolean;
  template_id: string | null;
  recurrence_source_task_id: string | null;
  task_type_id: string | null;
  created_at: string;
  task_assignees: TaskAssignee[];
  contacts: ContactOption | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskProject {
  id: string;
  name: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  default_due_days: number | null;
  due_amount: number | null;
  due_unit: string | null;
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
}

const toDateStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const computeOccurrences = (startDate: string, endDate: string, frequency: number, unit: string): string[] => {
  const dates: string[] = [];
  const end = new Date(endDate + "T12:00:00");
  let current = new Date(startDate + "T12:00:00");
  while (current <= end) {
    dates.push(toDateStr(current));
    const next = new Date(current);
    if (unit === "days") next.setDate(next.getDate() + frequency);
    else if (unit === "weeks") next.setDate(next.getDate() + frequency * 7);
    else if (unit === "months") next.setMonth(next.getMonth() + frequency);
    current = next;
  }
  return dates;
};

export default function TasksPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [taskProjectMap, setTaskProjectMap] = useState<Record<string, TaskProject[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string>("");
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [templateChain, setTemplateChain] = useState<{ name: string; delayDays: number }[]>([]);
  const [creationResult, setCreationResult] = useState<string | null>(null);
  const [recurringDates, setRecurringDates] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: "",
    contact_id: "",
    priority: "medium",
    status: "pending",
    start_date: "",
    due_date: "",
    is_milestone: false,
  });

  const [filterValues, setFilterValues] = useState<FilterValues>({});

  const filterDefs: FilterDef[] = useMemo(
    () => [
      {
        type: "multi-select" as const,
        key: "projects",
        label: "Project",
        options: projects.map((p) => ({ value: p.id, label: p.name })),
      },
      {
        type: "multi-select" as const,
        key: "contacts",
        label: "Contact",
        options: contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })),
      },
      {
        type: "multi-select" as const,
        key: "employees",
        label: "Employee",
        options: employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
      },
      {
        type: "single-select" as const,
        key: "priority",
        label: "Priority",
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "urgent", label: "Urgent" },
        ],
      },
      {
        type: "single-select" as const,
        key: "taskType",
        label: "Task Type",
        options: taskTypes.map((t) => ({ value: t.id, label: t.name })),
      },
      {
        type: "date-range" as const,
        keyFrom: "dateFrom",
        keyTo: "dateTo",
        labelFrom: "Due From",
        labelTo: "Due To",
      },
    ],
    [projects, contacts, employees, taskTypes]
  );

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, contacts:contact_id(id, first_name, last_name, company)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch tasks:", error);
      setLoading(false);
      return;
    }

    const taskIds = (data || []).map((t: { id: string }) => t.id);
    const assigneeMap: Record<string, TaskAssignee[]> = {};

    if (taskIds.length > 0) {
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, employee_id, employees(id, first_name, last_name)")
        .in("task_id", taskIds);

      if (assignees) {
        for (const a of assignees as unknown as (TaskAssignee & { task_id: string })[]) {
          if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
          assigneeMap[a.task_id].push(a);
        }
      }
    }

    const tasksWithAssignees = (data || []).map((t: Task) => ({
      ...t,
      task_assignees: assigneeMap[t.id] || [],
    }));

    setTasks(tasksWithAssignees as Task[]);

    // Fetch project links from project_tasks junction table
    if (taskIds.length > 0) {
      const { data: projectTasks } = await supabase
        .from("project_tasks")
        .select("task_id, project_id")
        .in("task_id", taskIds);

      if (projectTasks && projectTasks.length > 0) {
        const projectIds = [
          ...new Set(projectTasks.map((pt: { project_id: string }) => pt.project_id)),
        ];

        const { data: projectData } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        const projectNameMap: Record<string, string> = {};
        if (projectData) {
          for (const p of projectData) {
            projectNameMap[p.id] = p.name;
          }
        }

        const tpMap: Record<string, TaskProject[]> = {};
        for (const pt of projectTasks as { task_id: string; project_id: string }[]) {
          const name = projectNameMap[pt.project_id];
          if (name) {
            if (!tpMap[pt.task_id]) tpMap[pt.task_id] = [];
            tpMap[pt.task_id].push({ id: pt.project_id, name });
          }
        }

        setTaskProjectMap(tpMap);
      }
    }

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
      .select("id, first_name, last_name, company")
      .order("first_name");
    setContacts(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("id, name, description, default_priority, default_due_days, due_amount, due_unit, task_type_id, is_recurring, recurrence_frequency, recurrence_unit, recurrence_count")
      .order("name");
    setTemplates(data || []);
  };

  const fetchTaskTypes = async () => {
    const { data } = await supabase
      .from("task_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name");
    setTaskTypes(data || []);
  };

  const fetchChain = async (templateId: string) => {
    const { data: steps } = await supabase
      .from("task_workflow_steps")
      .select("template_id, next_template_id, delay_days");
    if (!steps) { setTemplateChain([]); return; }

    const stepMap: Record<string, { next_template_id: string; delay_days: number }> = {};
    for (const s of steps) stepMap[s.template_id] = { next_template_id: s.next_template_id, delay_days: s.delay_days };

    const chain: { name: string; delayDays: number }[] = [];
    const visited = new Set<string>();
    let currentId = templateId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const step = stepMap[currentId];
      if (!step || !step.next_template_id) break;
      const nextTmpl = templates.find((t) => t.id === step.next_template_id);
      if (!nextTmpl) break;
      chain.push({ name: nextTmpl.name, delayDays: step.delay_days });
      currentId = step.next_template_id;
    }
    setTemplateChain(chain);
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchProjects();
    fetchContacts();
    fetchTemplates();
    fetchTaskTypes();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) { setRecurringDates([]); return; }
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl?.is_recurring || !tmpl.recurrence_frequency || !tmpl.recurrence_unit) { setRecurringDates([]); return; }
    if (!form.start_date || !form.due_date) { setRecurringDates([]); return; }
    const dates = computeOccurrences(form.start_date, form.due_date, tmpl.recurrence_frequency, tmpl.recurrence_unit);
    setRecurringDates(dates);
  }, [form.start_date, form.due_date, selectedTemplateId, templates]);

  const applyTemplate = (templateId: string) => {
    if (templateId === "none") {
      setSelectedTemplateId("");
      setSelectedTaskTypeId("");
      setTemplateChain([]);
      return;
    }

    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;

    setSelectedTemplateId(templateId);
    setSelectedTaskTypeId(tmpl.task_type_id || "");
    fetchChain(templateId);

    if (tmpl.is_recurring) {
      // For recurring templates, set title/description/priority but calculate due_date from count
      const startDate = form.start_date || todayCST();
      let dueDate = "";
      if (tmpl.recurrence_frequency && tmpl.recurrence_unit && tmpl.recurrence_count) {
        const d = new Date(startDate + "T12:00:00");
        const totalOffset = tmpl.recurrence_frequency * (tmpl.recurrence_count - 1);
        if (tmpl.recurrence_unit === "days") d.setDate(d.getDate() + totalOffset);
        else if (tmpl.recurrence_unit === "weeks") d.setDate(d.getDate() + totalOffset * 7);
        else if (tmpl.recurrence_unit === "months") d.setMonth(d.getMonth() + totalOffset);
        dueDate = toDateStr(d);
      }
      setForm({
        ...form,
        title: tmpl.name,
        description: tmpl.description || "",
        priority: tmpl.default_priority,
        start_date: startDate,
        due_date: dueDate || form.due_date,
      });
    } else {
      // For non-recurring: calculate due_date from due_amount/unit
      let dueDate = "";
      const amount = tmpl.due_amount || tmpl.default_due_days;
      const unit = tmpl.due_unit || "days";
      if (amount) {
        const d = new Date();
        if (unit === "hours") d.setHours(d.getHours() + amount);
        else if (unit === "days") d.setDate(d.getDate() + amount);
        else if (unit === "weeks") d.setDate(d.getDate() + amount * 7);
        else if (unit === "months") d.setMonth(d.getMonth() + amount);
        dueDate = toDateStr(d);
      }
      setForm({
        ...form,
        title: tmpl.name,
        description: tmpl.description || "",
        priority: tmpl.default_priority,
        due_date: dueDate || form.due_date,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setCreationResult(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message || "You must be logged in to create a task.");
      setSaving(false);
      return;
    }

    // Create the first/primary task
    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: form.title,
        description: form.description || null,
        contact_id: form.contact_id || null,
        priority: form.priority,
        status: form.status,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        is_milestone: form.is_milestone,
        task_type_id: selectedTaskTypeId || null,
        template_id: selectedTemplateId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    let totalCreated = 1;

    if (task && selectedEmployees.length > 0) {
      const { error: assignError } = await supabase
        .from("task_assignees")
        .insert(
          selectedEmployees.map((empId) => ({
            task_id: task.id,
            employee_id: empId,
          }))
        );
      if (assignError) {
        setError(
          "Task created but failed to assign employees: " +
            assignError.message
        );
      }
    }

    // Link to project via junction table
    if (task && form.project_id) {
      const { error: projectLinkError } = await supabase
        .from("project_tasks")
        .insert({
          task_id: task.id,
          project_id: form.project_id,
        });
      if (projectLinkError) {
        setError("Task created but failed to link project: " + projectLinkError.message);
        setSaving(false);
        return;
      }
    }

    if (task && selectedTemplateId) {
      const tmpl = templates.find((t) => t.id === selectedTemplateId);

      // If template is recurring and we have computed dates, create all instances
      if (tmpl?.is_recurring && tmpl.recurrence_frequency && tmpl.recurrence_unit && recurringDates.length > 0) {
        // Update first task with recurring metadata
        await supabase.from("tasks").update({
          is_recurring: true,
          recurrence_frequency: tmpl.recurrence_frequency,
          recurrence_unit: tmpl.recurrence_unit,
          recurrence_source_task_id: task.id,
          due_date: recurringDates[0],
        }).eq("id", task.id);

        // Create remaining occurrences (index 1 onward)
        for (let i = 1; i < recurringDates.length; i++) {
          const { data: recurTask } = await supabase.from("tasks").insert({
            title: form.title,
            description: form.description || null,
            contact_id: form.contact_id || null,
            priority: form.priority,
            status: "pending",
            start_date: recurringDates[i],
            due_date: recurringDates[i],
            is_milestone: form.is_milestone,
            task_type_id: selectedTaskTypeId || null,
            template_id: selectedTemplateId,
            is_recurring: true,
            recurrence_frequency: tmpl.recurrence_frequency,
            recurrence_unit: tmpl.recurrence_unit,
            recurrence_source_task_id: task.id,
            parent_task_id: task.id,
            created_by: user.id,
          }).select().single();

          if (recurTask) {
            totalCreated++;
            // Copy assignees
            if (selectedEmployees.length > 0) {
              await supabase.from("task_assignees").insert(
                selectedEmployees.map((empId) => ({ task_id: recurTask.id, employee_id: empId }))
              );
            }
            // Link to same project
            if (form.project_id) {
              await supabase.from("project_tasks").insert({ task_id: recurTask.id, project_id: form.project_id });
            }
          }
        }
      }

      // Show creation result
      if (templateChain.length > 0) {
        setCreationResult(
          `Created ${totalCreated} task${totalCreated > 1 ? "s" : ""} from template` +
          `. ${templateChain.length} follow-up task${templateChain.length > 1 ? "s" : ""} will be created on completion.`
        );
      } else {
        setCreationResult(`Created ${totalCreated} task${totalCreated > 1 ? "s" : ""} from template`);
      }
    }

    setForm({
      title: "",
      description: "",
      project_id: "",
      contact_id: "",
      priority: "medium",
      status: "pending",
      start_date: "",
      due_date: "",
      is_milestone: false,
    });
    setSelectedTemplateId("");
    setSelectedEmployees([]);
    setSelectedTaskTypeId("");
    setTemplateChain([]);
    setRecurringDates([]);
    setOpen(false);
    fetchTasks();
    setSaving(false);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
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
    cancelled: "bg-gray-100 text-gray-800",
    blocked: "bg-red-100 text-red-800",
  };

  // Inline edit state
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);

  const handleInlineUpdate = async (taskId: string, field: string, value: string) => {
    const key = `${taskId}-${field}`;
    setSavingCell(key);
    setSavedCell(null);
    const updateData: Record<string, unknown> = { [field]: value };
    if (field === "status" && value === "completed") {
      updateData.completed_at = nowUTC();
    }
    await supabase.from("tasks").update(updateData).eq("id", taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t));
    setSavingCell(null);
    setSavedCell(key);
    setTimeout(() => setSavedCell((prev) => prev === key ? null : prev), 1500);
  };

  // Delete state
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDeps, setDeleteDeps] = useState<number>(0);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const checkAndDelete = async (taskId: string) => {
    setDeleteTaskId(taskId);
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("parent_task_id", taskId);
    setDeleteDeps(count || 0);
  };

  const confirmDelete = async () => {
    if (!deleteTaskId) return;
    setDeleteLoading(true);
    await supabase.from("task_assignees").delete().eq("task_id", deleteTaskId);
    await supabase.from("project_tasks").delete().eq("task_id", deleteTaskId);
    await supabase.from("tasks").delete().eq("id", deleteTaskId);
    setTasks((prev) => prev.filter((t) => t.id !== deleteTaskId));
    setDeleteLoading(false);
    setDeleteTaskId(null);
    setDeleteMessage("Task deleted");
    setTimeout(() => setDeleteMessage(null), 3000);
  };

  const dueDateRelative = (dateStr: string) => {
    const overdue = isBeforeToday(dateStr);
    const text = formatRelativeTimeUtil(dateStr);
    return overdue
      ? { text: `${text} overdue`, className: "text-red-600" }
      : { text: `in ${text}`, className: "text-muted-foreground" };
  };

  const filterTasks = (filter: string) => {
    let filtered = tasks;
    if (filter === "milestones") filtered = tasks.filter((t) => t.is_milestone);
    else if (filter !== "all") filtered = tasks.filter((t) => t.status === filter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }

    // Project filter
    const projectIds = filterValues.projects;
    if (Array.isArray(projectIds) && projectIds.length > 0) {
      filtered = filtered.filter((t) => {
        const taskProjects = taskProjectMap[t.id] || [];
        return taskProjects.some((p) => projectIds.includes(p.id));
      });
    }

    // Contact filter
    const contactIds = filterValues.contacts;
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      filtered = filtered.filter((t) => t.contact_id && contactIds.includes(t.contact_id));
    }

    // Employee filter
    const employeeIds = filterValues.employees;
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      filtered = filtered.filter((t) =>
        t.task_assignees?.some((a: TaskAssignee) => employeeIds.includes(a.employee_id))
      );
    }

    // Priority filter
    const priority = filterValues.priority;
    if (typeof priority === "string" && priority !== "all") {
      filtered = filtered.filter((t) => t.priority === priority);
    }

    // Task Type filter
    const taskType = filterValues.taskType;
    if (typeof taskType === "string" && taskType !== "all") {
      filtered = filtered.filter((t) => t.task_type_id === taskType);
    }

    // Date range filter
    const dateFrom = filterValues.dateFrom;
    const dateTo = filterValues.dateTo;
    if (typeof dateFrom === "string" && dateFrom) {
      filtered = filtered.filter((t) => t.due_date && t.due_date >= dateFrom);
    }
    if (typeof dateTo === "string" && dateTo) {
      filtered = filtered.filter((t) => t.due_date && t.due_date <= dateTo);
    }

    return filtered;
  };

  const renderTable = (filteredTasks: Task[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Projects</TableHead>
          <TableHead>Employees</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8">
              Loading...
            </TableCell>
          </TableRow>
        ) : filteredTasks.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={9}
              className="text-center text-muted-foreground py-8"
            >
              No tasks found.
            </TableCell>
          </TableRow>
        ) : (
          filteredTasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {task.is_milestone && (
                    <Diamond className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  {(task.is_recurring || task.recurrence_source_task_id) && (
                    <span title="Part of recurring series">
                      <RefreshCw className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    </span>
                  )}
                  <div>
                    <div className="font-medium">
                      {task.title}
                      {task.is_milestone && (
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-amber-100 text-amber-800 text-xs"
                        >
                          Milestone
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {task.description}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {(() => {
                  const tt = taskTypes.find((x) => x.id === task.task_type_id);
                  return tt ? (
                    <Badge variant="secondary" className={COLOR_MAP[tt.color] || ""}>{tt.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  );
                })()}
              </TableCell>
              <TableCell>
                {task.contacts ? (
                  <span
                    className="text-blue-600 hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/contacts/${task.contacts!.id}`);
                    }}
                  >
                    {contactName(task.contacts)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {(() => {
                  const taskProjects = taskProjectMap[task.id];
                  if (!taskProjects || taskProjects.length === 0) {
                    return <span className="text-muted-foreground">—</span>;
                  }
                  if (taskProjects.length <= 2) {
                    return (
                      <div className="flex flex-wrap gap-1">
                        {taskProjects.map((p) => (
                          <span
                            key={p.id}
                            className="text-blue-600 hover:underline cursor-pointer text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/projects/${p.id}`);
                            }}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <span
                          className="text-blue-600 hover:underline cursor-pointer text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {taskProjects.length} Projects
                        </span>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          {taskProjects.map((p) => (
                            <div
                              key={p.id}
                              className="text-sm text-blue-600 hover:underline cursor-pointer px-2 py-1 rounded hover:bg-muted"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/projects/${p.id}`);
                              }}
                            >
                              {p.name}
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </TableCell>
              <TableCell>
                {task.task_assignees?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.task_assignees.map((a) => (
                      <Badge
                        key={a.employee_id}
                        variant="outline"
                        className="text-xs"
                      >
                        {a.employees ? employeeName(a.employees) : ""}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
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
                  {savingCell === `${task.id}-priority` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {savedCell === `${task.id}-priority` && <Check className="h-3 w-3 text-green-600" />}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Select value={task.status} onValueChange={(v) => handleInlineUpdate(task.id, "status", v)}>
                    <SelectTrigger className={`h-7 w-[130px] rounded-full border-0 text-xs font-semibold shadow-none capitalize ${statusColors[task.status] || ""}`}>
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
                  {savingCell === `${task.id}-status` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {savedCell === `${task.id}-status` && <Check className="h-3 w-3 text-green-600" />}
                </div>
              </TableCell>
              <TableCell>
                {task.due_date ? (
                  <div>
                    <div className="text-sm">{formatDate(task.due_date)}</div>
                    {task.status !== "completed" && (() => {
                      const rel = dueDateRelative(task.due_date);
                      return <div className={`text-xs ${rel.className}`}>{rel.text}</div>;
                    })()}
                  </div>
                ) : "—"}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  onClick={() => checkAndDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
  <h2 className="text-2xl font-bold">Tasks</h2>
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        New Task
      </Button>
    </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>New Task</DialogTitle>
                <DialogDescription>
                  Create a new task to track.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Template & Schedule Section */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <p className="text-sm font-medium">Template & Schedule</p>

                  <div className="grid gap-2">
                    <Label>Start from Template <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Select
                      value={selectedTemplateId || "none"}
                      onValueChange={(value) => applyTemplate(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None - Create blank task" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None - Create blank task</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              {t.name}
                              {(() => {
                                const tt = taskTypes.find((x) => x.id === t.task_type_id);
                                return tt ? <Badge variant="secondary" className={`text-xs ${COLOR_MAP[tt.color] || ""}`}>{tt.name}</Badge> : null;
                              })()}
                              {t.is_recurring && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start_date">
                        {(() => {
                          const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                          return tmpl?.is_recurring ? "First Occurrence *" : "Start Date";
                        })()}
                      </Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={form.start_date}
                        required={(() => {
                          const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                          return !!tmpl?.is_recurring;
                        })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                          if (tmpl?.is_recurring && tmpl.recurrence_frequency && tmpl.recurrence_unit && tmpl.recurrence_count && val) {
                            const d = new Date(val + "T12:00:00");
                            const totalOffset = tmpl.recurrence_frequency * (tmpl.recurrence_count - 1);
                            if (tmpl.recurrence_unit === "days") d.setDate(d.getDate() + totalOffset);
                            else if (tmpl.recurrence_unit === "weeks") d.setDate(d.getDate() + totalOffset * 7);
                            else if (tmpl.recurrence_unit === "months") d.setMonth(d.getMonth() + totalOffset);
                            const calculatedEnd = toDateStr(d);
                            setForm((prev) => ({ ...prev, start_date: val, due_date: calculatedEnd }));
                          } else {
                            setForm((prev) => ({
                              ...prev,
                              start_date: val,
                              due_date: prev.due_date || val,
                            }));
                          }
                        }}
                      />
                      {form.start_date && (
                        <span className="text-xs text-muted-foreground">{formatDate(form.start_date)}</span>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="due_date">
                        {(() => {
                          const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                          return tmpl?.is_recurring ? "Recurrence End Date" : "Due Date";
                        })()}
                      </Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={form.due_date}
                        onChange={(e) =>
                          setForm({ ...form, due_date: e.target.value })
                        }
                      />
                      {form.due_date && (
                        <span className="text-xs text-muted-foreground">{formatDate(form.due_date)}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick duration buttons - only for non-recurring */}
                  {!(() => {
                    const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                    return tmpl?.is_recurring;
                  })() && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "4h", days: 0 },
                        { label: "1d", days: 1 },
                        { label: "3d", days: 3 },
                        { label: "1w", days: 7 },
                        { label: "2w", days: 14 },
                        { label: "1m", days: 30 },
                      ].map((q) => (
                        <Button
                          key={q.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            const startStr = form.start_date || todayCST();
                            const due = addDaysToDate(startStr, q.days);
                            setForm((prev) => ({
                              ...prev,
                              start_date: prev.start_date || todayCST(),
                              due_date: due,
                            }));
                          }}
                        >
                          {q.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Recurring dates preview */}
                  {(() => {
                    const tmpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
                    if (!tmpl?.is_recurring) return null;

                    const defaultCount = tmpl.recurrence_count || null;
                    const overrideWarning = defaultCount && recurringDates.length > 0 && recurringDates.length !== defaultCount;

                    return (
                      <div className="rounded border bg-background p-3 space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-1">
                          <RefreshCw className="h-3 w-3" />
                          Recurring — every {tmpl.recurrence_frequency} {tmpl.recurrence_unit}
                          {defaultCount && <span className="ml-1">({defaultCount} occurrences)</span>}
                        </div>
                        {recurringDates.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              This will create {recurringDates.length} task{recurringDates.length !== 1 ? "s" : ""}:
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                              {recurringDates.map((date, i) => (
                                <p key={i} className="text-xs text-muted-foreground pl-2">
                                  {i + 1}. {formatDateLong(date)}
                                </p>
                              ))}
                            </div>
                            {overrideWarning && (
                              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                                Template default is {defaultCount} occurrence{defaultCount !== 1 ? "s" : ""}, but date range will create {recurringDates.length}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Set start date and end date to preview occurrences
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Workflow chain preview (non-recurring feature) */}
                  {templateChain.length > 0 && (
                    <div className="rounded border bg-background p-3 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        Follow-up tasks on completion:
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="default" className="text-xs">{templates.find((t) => t.id === selectedTemplateId)?.name}</Badge>
                        {templateChain.map((step, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">—{step.delayDays}d→</span>
                            <Badge variant="outline" className="text-xs">{step.name}</Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
                {projects.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Project{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={form.project_id || "none"}
                      onValueChange={(value) =>
                        setForm({ ...form, project_id: value === "none" ? "" : value })
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
                {contacts.length > 0 && (
                  <div className="grid gap-2">
                    <Label>
                      Contact{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={form.contact_id || "none"}
                      onValueChange={(value) =>
                        setForm({ ...form, contact_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {contactDisplay(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(value) =>
                        setForm({ ...form, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
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
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">
                          In Progress
                        </SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Employees</Label>
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
                          : "Select employees..."}
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
                              <span className="text-sm">{employeeName(emp)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.is_milestone}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, is_milestone: !!checked })
                    }
                  />
                  <div className="flex items-center gap-1.5">
                    <Diamond className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      Mark as milestone
                    </span>
                  </div>
                </label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {creationResult && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center justify-between">
          <span>{creationResult}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCreationResult(null)}>Dismiss</Button>
        </div>
      )}

      {deleteMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center justify-between">
          <span>{deleteMessage}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDeleteMessage(null)}>Dismiss</Button>
        </div>
      )}

      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => { if (!open) setDeleteTaskId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDeps > 0
                ? `Cannot delete — ${deleteDeps} task${deleteDeps > 1 ? "s" : ""} depend${deleteDeps === 1 ? "s" : ""} on this task.`
                : "Are you sure? This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteDeps === 0 && (
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <FilterPanel
        filters={filterDefs}
        values={filterValues}
        onChange={(key, value) => setFilterValues(prev => ({ ...prev, [key]: value }))}
        onClear={() => setFilterValues(defaultFilterValues(filterDefs))}
      />

      <Tabs defaultValue={searchParams.get("status") || "all"}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="milestones">
            <Diamond className="mr-1.5 h-3 w-3" />
            Milestones
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Complete list of all tasks.</CardDescription>
            </CardHeader>
            <CardContent>{renderTable(filterTasks("all"))}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("pending"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="in_progress">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("in_progress"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="completed">
          <Card>
            <CardContent className="pt-6">
              {renderTable(filterTasks("completed"))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>
                Key milestones across all tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(filterTasks("milestones"))}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

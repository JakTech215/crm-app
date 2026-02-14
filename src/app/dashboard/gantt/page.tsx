"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from "lucide-react";

interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  project_ids: string[];
  project_names: string[];
  assignee_ids: string[];
  assignee_names: string[];
  contact_id: string | null;
  contact_name: string | null;
}

interface Dependency {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  lag_days: number;
}

interface Project {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
  blocked: "bg-red-400",
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-red-500",
  high: "border-orange-500",
  medium: "border-blue-400",
  low: "border-slate-300",
};

type ZoomLevel = "day" | "week" | "month";

export default function GanttPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  // Filter state — initialized from URL params
  const [filtersOpen, setFiltersOpen] = useState(
    searchParams.get("filters") === "open"
  );
  const [filterProjects, setFilterProjects] = useState<string[]>(() => {
    const p = searchParams.get("projects");
    return p ? p.split(",") : [];
  });
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "all"
  );
  const [filterPriority, setFilterPriority] = useState(
    searchParams.get("priority") || "all"
  );
  const [filterMilestoneOnly, setFilterMilestoneOnly] = useState(
    searchParams.get("milestone") === "true"
  );
  const [filterDateFrom, setFilterDateFrom] = useState(
    searchParams.get("dateFrom") || ""
  );
  const [filterDateTo, setFilterDateTo] = useState(
    searchParams.get("dateTo") || ""
  );
  const [filterEmployee, setFilterEmployee] = useState(
    searchParams.get("employee") || "all"
  );

  // Sync filters to URL
  const syncFiltersToUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (filtersOpen) params.set("filters", "open");
    if (filterProjects.length > 0) params.set("projects", filterProjects.join(","));
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    if (filterMilestoneOnly) params.set("milestone", "true");
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    if (filterEmployee !== "all") params.set("employee", filterEmployee);
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [filtersOpen, filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee]);

  useEffect(() => {
    syncFiltersToUrl();
  }, [syncFiltersToUrl]);

  const fetchData = async () => {
    const [{ data: taskData }, { data: depData }, { data: projData }, { data: ptLinks }, { data: assigneeData }, { data: empData }] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, start_date, due_date, is_milestone, contact_id, contacts:contact_id(id, first_name, last_name)")
          .order("start_date"),
        supabase.from("task_dependencies").select("task_id, depends_on_task_id, dependency_type, lag_days"),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("project_tasks").select("task_id, project_id"),
        supabase.from("task_assignees").select("task_id, employee_id"),
        supabase.from("employees").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      ]);

    // Build task→projects mapping (many-to-many)
    const taskProjectsMap: Record<string, string[]> = {};
    (ptLinks || []).forEach((link: { task_id: string; project_id: string }) => {
      if (!taskProjectsMap[link.task_id]) taskProjectsMap[link.task_id] = [];
      taskProjectsMap[link.task_id].push(link.project_id);
    });

    // Build task→assignees mapping
    const taskAssigneesMap: Record<string, string[]> = {};
    (assigneeData || []).forEach((a: { task_id: string; employee_id: string }) => {
      if (!taskAssigneesMap[a.task_id]) taskAssigneesMap[a.task_id] = [];
      taskAssigneesMap[a.task_id].push(a.employee_id);
    });

    const projMap: Record<string, string> = {};
    (projData || []).forEach((p: Project) => {
      projMap[p.id] = p.name;
    });

    const empNameMap: Record<string, string> = {};
    (empData || []).forEach((e: Employee) => {
      empNameMap[e.id] = `${e.first_name} ${e.last_name}`;
    });

    const enriched = (taskData || []).map(
      (t: Record<string, unknown>) => {
        const id = t.id as string;
        const contactObj = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
        const projectIds = taskProjectsMap[id] || [];
        const aIds = taskAssigneesMap[id] || [];
        return {
          id,
          title: t.title as string,
          status: t.status as string,
          priority: t.priority as string,
          start_date: t.start_date as string | null,
          due_date: t.due_date as string | null,
          is_milestone: t.is_milestone as boolean,
          project_ids: projectIds,
          project_names: projectIds.map((pid) => projMap[pid]).filter(Boolean),
          assignee_ids: aIds,
          assignee_names: aIds.map((eid) => empNameMap[eid]).filter(Boolean),
          contact_id: (t.contact_id as string | null),
          contact_name: contactObj ? `${(contactObj as { first_name: string; last_name: string | null }).first_name}${(contactObj as { last_name: string | null }).last_name ? ` ${(contactObj as { last_name: string | null }).last_name}` : ""}` : null,
        };
      }
    );

    setTasks(enriched);
    setDependencies((depData || []) as Dependency[]);
    setProjects(projData || []);
    setEmployees(empData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProjects.length > 0) count++;
    if (filterStatus !== "all") count++;
    if (filterPriority !== "all") count++;
    if (filterMilestoneOnly) count++;
    if (filterDateFrom || filterDateTo) count++;
    if (filterEmployee !== "all") count++;
    return count;
  }, [filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee]);

  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterMilestoneOnly(false);
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterEmployee("all");
  };

  // Apply filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Project filter
      if (filterProjects.length > 0) {
        if (filterProjects.includes("__unassigned__")) {
          // "Unassigned" selected — include unassigned tasks + any selected real projects
          const realProjects = filterProjects.filter((p) => p !== "__unassigned__");
          const matchesUnassigned = t.project_ids.length === 0;
          const matchesProject = realProjects.length > 0 && t.project_ids.some((pid) => realProjects.includes(pid));
          if (!matchesUnassigned && !matchesProject) return false;
        } else {
          if (!t.project_ids.some((pid) => filterProjects.includes(pid))) return false;
        }
      }

      // Status filter
      if (filterStatus !== "all" && t.status !== filterStatus) return false;

      // Priority filter
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;

      // Milestone filter
      if (filterMilestoneOnly && !t.is_milestone) return false;

      // Date range filter
      if (filterDateFrom && t.due_date && t.due_date < filterDateFrom) return false;
      if (filterDateTo && t.start_date && t.start_date > filterDateTo) return false;

      // Employee filter
      if (filterEmployee !== "all" && !t.assignee_ids.includes(filterEmployee)) return false;

      return true;
    });
  }, [tasks, filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee]);

  const toggleProjectFilter = (projectId: string) => {
    setFilterProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  // Calculate date range based on zoom
  const getColumnWidth = () => {
    if (zoom === "day") return 40;
    if (zoom === "week") return 120;
    return 160;
  };

  const getDateRange = () => {
    const colWidth = getColumnWidth();
    const numCols = zoom === "day" ? 60 : zoom === "week" ? 16 : 12;
    const dates: Date[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < numCols; i++) {
      const d = new Date(start);
      if (zoom === "day") d.setDate(start.getDate() + i);
      else if (zoom === "week") d.setDate(start.getDate() + i * 7);
      else d.setMonth(start.getMonth() + i);
      dates.push(d);
    }

    return { dates, colWidth, totalWidth: numCols * colWidth };
  };

  const { dates, colWidth, totalWidth } = getDateRange();

  const rangeStart = dates[0];
  const rangeEnd = new Date(dates[dates.length - 1]);
  if (zoom === "day") rangeEnd.setDate(rangeEnd.getDate() + 1);
  else if (zoom === "week") rangeEnd.setDate(rangeEnd.getDate() + 7);
  else rangeEnd.setMonth(rangeEnd.getMonth() + 1);

  const dateToX = (dateStr: string) => {
    const d = new Date(dateStr);
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const elapsedMs = d.getTime() - rangeStart.getTime();
    return (elapsedMs / totalMs) * totalWidth;
  };

  const todayX = dateToX(new Date().toISOString());

  // Group filtered tasks by project
  const grouped: { project: string | null; projectId: string | null; tasks: GanttTask[] }[] = [];
  const projectGroups = new Map<string, GanttTask[]>();
  const unassigned: GanttTask[] = [];

  for (const t of filteredTasks) {
    if (t.project_names.length === 0) {
      unassigned.push(t);
    } else {
      for (const pName of t.project_names) {
        if (!projectGroups.has(pName)) projectGroups.set(pName, []);
        projectGroups.get(pName)!.push(t);
      }
    }
  }
  for (const p of projects) {
    if (projectGroups.has(p.name)) {
      grouped.push({ project: p.name, projectId: p.id, tasks: projectGroups.get(p.name)! });
    }
  }
  if (unassigned.length > 0) {
    grouped.push({ project: null, projectId: null, tasks: unassigned });
  }

  const allRows: { type: "header" | "task"; label: string; task?: GanttTask; projectId?: string | null; rowKey: string }[] = [];
  for (const g of grouped) {
    allRows.push({ type: "header", label: g.project || "No Project", projectId: g.projectId, rowKey: `hdr-${g.project || "none"}` });
    for (const t of g.tasks) {
      allRows.push({ type: "task", label: t.title, task: t, rowKey: `task-${t.id}-${g.project || "none"}` });
    }
  }

  const ROW_HEIGHT = 40;

  // Build task position map for dependency arrows
  const taskRowMap: Record<string, number> = {};
  const taskXMap: Record<string, { x: number; w: number }> = {};
  let rowIndex = 0;
  for (const row of allRows) {
    if (row.type === "task" && row.task && !taskRowMap.hasOwnProperty(row.task.id)) {
      taskRowMap[row.task.id] = rowIndex;
      if (row.task.start_date && row.task.due_date) {
        const x1 = dateToX(row.task.start_date);
        const x2 = dateToX(row.task.due_date);
        taskXMap[row.task.id] = { x: Math.max(x1, 0), w: Math.max(x2 - x1, 8) };
      }
    }
    rowIndex++;
  }

  const navigate = (dir: number) => {
    const d = new Date(startDate);
    if (zoom === "day") d.setDate(d.getDate() + dir * 14);
    else if (zoom === "week") d.setDate(d.getDate() + dir * 28);
    else d.setMonth(d.getMonth() + dir * 3);
    setStartDate(d);
  };

  const formatHeader = (d: Date) => {
    if (zoom === "day") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (zoom === "week") {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { day: "numeric" })}`;
    }
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  // Active filter badges
  const filterBadges: { label: string; onRemove: () => void }[] = [];
  if (filterProjects.length > 0) {
    const names = filterProjects.map((pid) => {
      if (pid === "__unassigned__") return "Unassigned";
      return projects.find((p) => p.id === pid)?.name || pid;
    });
    filterBadges.push({
      label: `Projects: ${names.join(", ")}`,
      onRemove: () => setFilterProjects([]),
    });
  }
  if (filterStatus !== "all") {
    filterBadges.push({
      label: `Status: ${filterStatus.replace("_", " ")}`,
      onRemove: () => setFilterStatus("all"),
    });
  }
  if (filterPriority !== "all") {
    filterBadges.push({
      label: `Priority: ${filterPriority}`,
      onRemove: () => setFilterPriority("all"),
    });
  }
  if (filterMilestoneOnly) {
    filterBadges.push({
      label: "Milestones only",
      onRemove: () => setFilterMilestoneOnly(false),
    });
  }
  if (filterDateFrom || filterDateTo) {
    const parts = [];
    if (filterDateFrom) parts.push(`from ${filterDateFrom}`);
    if (filterDateTo) parts.push(`to ${filterDateTo}`);
    filterBadges.push({
      label: `Date: ${parts.join(" ")}`,
      onRemove: () => { setFilterDateFrom(""); setFilterDateTo(""); },
    });
  }
  if (filterEmployee !== "all") {
    const emp = employees.find((e) => e.id === filterEmployee);
    filterBadges.push({
      label: `Assignee: ${emp ? employeeName(emp) : filterEmployee}`,
      onRemove: () => setFilterEmployee("all"),
    });
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gantt Chart</h1>
          <p className="text-muted-foreground">
            Visual timeline of tasks and dependencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                {activeFilterCount}
              </Badge>
            )}
            {filtersOpen ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 7);
              setStartDate(d);
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Project filter (multi-select) */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Projects</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start h-9 text-sm">
                      {filterProjects.length > 0
                        ? `${filterProjects.length} selected`
                        : "All Projects"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      <label className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={filterProjects.includes("__unassigned__")}
                          onCheckedChange={() => toggleProjectFilter("__unassigned__")}
                        />
                        <span className="text-sm italic text-muted-foreground">Unassigned Tasks</span>
                      </label>
                      {projects.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={filterProjects.includes(p.id)}
                            onCheckedChange={() => toggleProjectFilter(p.id)}
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Employee filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Assignee</Label>
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignees</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {employeeName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Date From</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Date To</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Milestone toggle + clear */}
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filterMilestoneOnly}
                  onCheckedChange={(checked) => setFilterMilestoneOnly(!!checked)}
                />
                <span className="text-sm">Show only milestones</span>
              </label>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filter badges */}
      {filterBadges.length > 0 && !filtersOpen && (
        <div className="flex flex-wrap items-center gap-2">
          {filterBadges.map((fb) => (
            <Badge key={fb.label} variant="secondary" className="flex items-center gap-1 pr-1 capitalize">
              {fb.label}
              <button className="ml-1 rounded-full hover:bg-muted p-0.5" onClick={fb.onRemove}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Showing {filteredTasks.filter((t) => t.start_date && t.due_date).length} of{" "}
            {tasks.length} tasks
            {filteredTasks.filter((t) => t.start_date && t.due_date).length !== filteredTasks.length && (
              <span className="ml-1 text-orange-600">
                ({filteredTasks.filter((t) => !t.start_date || !t.due_date).length} without dates)
              </span>
            )}
            {activeFilterCount > 0 && (
              <span className="ml-1">
                ({activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Filter className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">No tasks found.</p>
              <p className="text-xs mt-1">Try adjusting your filters to see more tasks.</p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex">
                {/* Left panel: task labels */}
                <div className="w-56 shrink-0 border-r">
                  <div className="h-10 border-b bg-muted/50 flex items-center px-3">
                    <span className="text-xs font-medium text-muted-foreground">Task</span>
                  </div>
                  {allRows.map((row) => (
                    <div
                      key={row.rowKey}
                      className={`flex items-center px-3 border-b ${
                        row.type === "header"
                          ? "bg-muted/30 font-semibold text-sm"
                          : "text-sm cursor-pointer hover:bg-muted/50"
                      }`}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => {
                        if (row.type === "task" && row.task) {
                          router.push(`/dashboard/tasks/${row.task.id}`);
                        }
                      }}
                    >
                      {row.type === "header" ? (
                        row.projectId ? (
                          <span
                            className="truncate text-blue-600 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/projects/${row.projectId}`);
                            }}
                          >
                            {row.label}
                          </span>
                        ) : (
                          <span className="truncate">{row.label}</span>
                        )
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div
                              className="flex items-center gap-2 truncate w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                  STATUS_COLORS[row.task?.status || ""] || "bg-gray-400"
                                }`}
                              />
                              <span className="truncate">{row.label}</span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="start" side="right">
                            <div className="space-y-2">
                              <div
                                className="font-medium text-sm text-blue-600 hover:underline cursor-pointer"
                                onClick={() => router.push(`/dashboard/tasks/${row.task!.id}`)}
                              >
                                {row.task!.title}
                              </div>
                              <div className="text-xs space-y-1.5">
                                <div>
                                  <span className="text-muted-foreground">Contact: </span>
                                  {row.task!.contact_name ? (
                                    <span
                                      className="text-blue-600 hover:underline cursor-pointer"
                                      onClick={() => router.push(`/dashboard/contacts/${row.task!.contact_id}`)}
                                    >
                                      {row.task!.contact_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Projects: </span>
                                  {row.task!.project_names.length > 0 ? (
                                    <span>
                                      {row.task!.project_ids.map((pid, i) => (
                                        <span key={pid}>
                                          {i > 0 && ", "}
                                          <span
                                            className="text-blue-600 hover:underline cursor-pointer"
                                            onClick={() => router.push(`/dashboard/projects/${pid}`)}
                                          >
                                            {row.task!.project_names[i]}
                                          </span>
                                        </span>
                                      ))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Assignees: </span>
                                  {row.task!.assignee_names.length > 0 ? (
                                    <span>{row.task!.assignee_names.join(", ")}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ))}
                </div>

                {/* Right panel: chart */}
                <div className="flex-1 overflow-x-auto" ref={scrollRef}>
                  {/* Date headers */}
                  <div className="flex h-10 border-b bg-muted/50" style={{ width: totalWidth }}>
                    {dates.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center text-xs text-muted-foreground border-r"
                        style={{ width: colWidth }}
                      >
                        {formatHeader(d)}
                      </div>
                    ))}
                  </div>

                  {/* Chart rows */}
                  <div className="relative" style={{ width: totalWidth, height: allRows.length * ROW_HEIGHT }}>
                    {/* Grid lines */}
                    {dates.map((_, i) => (
                      <div
                        key={`grid-${i}`}
                        className="absolute top-0 bottom-0 border-r border-dashed border-muted"
                        style={{ left: i * colWidth }}
                      />
                    ))}

                    {/* Row backgrounds */}
                    {allRows.map((row, i) => (
                      <div
                        key={`row-${row.rowKey}`}
                        className={`absolute left-0 right-0 border-b ${
                          row.type === "header" ? "bg-muted/20" : ""
                        }`}
                        style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                      />
                    ))}

                    {/* Today marker */}
                    {todayX >= 0 && todayX <= totalWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: todayX }}
                      >
                        <div className="absolute -top-0 -left-2 px-1 bg-red-500 text-white text-[10px] rounded-b">
                          Today
                        </div>
                      </div>
                    )}

                    {/* Task bars */}
                    {allRows.map((row, i) => {
                      if (row.type !== "task" || !row.task || !row.task.start_date || !row.task.due_date) return null;
                      const x1 = dateToX(row.task.start_date);
                      const x2 = dateToX(row.task.due_date);
                      const barX = Math.max(x1, 0);
                      const barW = Math.max(x2 - x1, 8);

                      return (
                        <div
                          key={`bar-${row.rowKey}`}
                          className={`absolute rounded cursor-pointer transition-opacity hover:opacity-80 border-l-4 ${
                            STATUS_COLORS[row.task.status] || "bg-gray-400"
                          } ${PRIORITY_BORDER[row.task.priority] || "border-slate-300"}`}
                          style={{
                            left: barX,
                            width: barW,
                            top: i * ROW_HEIGHT + 10,
                            height: ROW_HEIGHT - 20,
                          }}
                          title={`${row.task.title} (${row.task.status})${row.task.contact_name ? `\nContact: ${row.task.contact_name}` : ""}${row.task.assignee_names.length > 0 ? `\nAssigned: ${row.task.assignee_names.join(", ")}` : ""}${row.task.project_names.length > 0 ? `\nProjects: ${row.task.project_names.join(", ")}` : ""}`}
                          onClick={() => router.push(`/dashboard/tasks/${row.task!.id}`)}
                        />
                      );
                    })}

                    {/* Dependency arrows (SVG) */}
                    <svg
                      className="absolute top-0 left-0 pointer-events-none z-10"
                      width={totalWidth}
                      height={allRows.length * ROW_HEIGHT}
                    >
                      {dependencies.map((dep) => {
                        const fromRow = taskRowMap[dep.depends_on_task_id];
                        const toRow = taskRowMap[dep.task_id];
                        const fromPos = taskXMap[dep.depends_on_task_id];
                        const toPos = taskXMap[dep.task_id];
                        if (fromRow === undefined || toRow === undefined || !fromPos || !toPos) return null;

                        const fromX = fromPos.x + fromPos.w;
                        const fromY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const toX = toPos.x;
                        const toY = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const midX = (fromX + toX) / 2;
                        const labelX = midX;
                        const labelY = (fromY + toY) / 2 - 6;
                        const typeLabel = dep.dependency_type?.replace(/_/g, " ") || "depends on";
                        const lagLabel = dep.lag_days ? ` +${dep.lag_days}d` : "";

                        return (
                          <g key={`dep-${dep.task_id}-${dep.depends_on_task_id}`}>
                            <path
                              d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                            <polygon
                              points={`${toX},${toY} ${toX - 6},${toY - 4} ${toX - 6},${toY + 4}`}
                              fill="#94a3b8"
                            />
                            <text
                              x={labelX}
                              y={labelY}
                              textAnchor="middle"
                              className="fill-muted-foreground"
                              fontSize="9"
                            >
                              {typeLabel}{lagLabel}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-3 border-t bg-muted/20">
                <span className="text-xs text-muted-foreground">Status:</span>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="text-xs">Pending</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-xs">In Progress</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-xs">Completed</span>
                </div>
                <span className="text-xs text-muted-foreground ml-4">Priority (left border):</span>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 border-l-4 border-red-500" />
                  <span className="text-xs">Urgent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 border-l-4 border-orange-500" />
                  <span className="text-xs">High</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

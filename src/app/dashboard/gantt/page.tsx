"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchGanttData,
  fetchGanttEvents,
  fetchGanttEventAttendees,
  fetchCustomHolidays,
  fetchFilterPresets,
  saveFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
} from "./actions";
import type { GanttFilterPreset } from "./actions";
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
  RefreshCw,
  Save,
  Trash2,
  Bookmark,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateLong, formatDateShort, nowCST, parseForDisplay } from "@/lib/dates";
import { getFederalHolidays, buildHolidayMap } from "@/lib/holidays";

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
  is_recurring: boolean;
  recurrence_source_task_id: string | null;
  recurrence_frequency: number | null;
  recurrence_unit: string | null;
  occurrences: { id: string; date: string; status: string }[];
  is_event?: boolean;
  event_type?: string;
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

type ZoomLevel = "day" | "5day" | "week" | "month" | "quarter";

export default function GanttPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("5day");
  const [startDate, setStartDate] = useState(() => {
    const d = nowCST();
    d.setDate(d.getDate() - 90);
    return d;
  });

  const [filtersOpen, setFiltersOpen] = useState(
    searchParams.get("filters") === "open"
  );
  const [filterProjects, setFilterProjects] = useState<string[]>(() => {
    const p = searchParams.get("projects");
    return p ? p.split(",") : [];
  });
  const [filterStatus, setFilterStatus] = useState<string[]>(() => {
    const raw = searchParams.get("status");
    return raw ? raw.split(",") : ["pending", "in_progress", "blocked"];
  });
  const [filterPriority, setFilterPriority] = useState<string[]>(() => {
    const raw = searchParams.get("priority");
    return raw ? raw.split(",") : [];
  });
  const [filterMilestoneOnly, setFilterMilestoneOnly] = useState(
    searchParams.get("milestone") === "true"
  );
  const [filterDateFrom, setFilterDateFrom] = useState(
    searchParams.get("dateFrom") || ""
  );
  const [filterDateTo, setFilterDateTo] = useState(
    searchParams.get("dateTo") || ""
  );
  const [filterEmployee, setFilterEmployee] = useState<string[]>(() => {
    const raw = searchParams.get("employee");
    return raw ? raw.split(",") : [];
  });
  const [showEvents, setShowEvents] = useState(true);
  const [presets, setPresets] = useState<GanttFilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [nameColWidth, setNameColWidth] = useState(224);
  const resizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(224);
  const [showHolidays, setShowHolidays] = useState(true);
  const [holidayMap, setHolidayMap] = useState<Record<string, string[]>>({});

  const syncFiltersToUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (filtersOpen) params.set("filters", "open");
    if (filterProjects.length > 0) params.set("projects", filterProjects.join(","));
    if (filterStatus.length > 0) params.set("status", filterStatus.join(","));
    if (filterPriority.length > 0) params.set("priority", filterPriority.join(","));
    if (filterMilestoneOnly) params.set("milestone", "true");
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    if (filterEmployee.length > 0) params.set("employee", filterEmployee.join(","));
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [filtersOpen, filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee]);

  useEffect(() => {
    syncFiltersToUrl();
  }, [syncFiltersToUrl]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = nameColWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.max(120, Math.min(600, resizeStartWidthRef.current + ev.clientX - resizeStartXRef.current));
      setNameColWidth(newWidth);
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [nameColWidth]);

  const fetchData = async () => {
    try {
    const { taskData: rawTaskData, depData, projData, ptLinks, assigneeData, empData } = await fetchGanttData();

    // Map task rows to include contacts in expected format
    const taskData = rawTaskData.map((r: Record<string, unknown>) => ({
      ...r,
      contacts: r.contact_id
        ? { first_name: r.contact_first_name, last_name: r.contact_last_name }
        : null,
    }));

    const taskProjectsMap: Record<string, string[]> = {};
    (ptLinks || []).forEach((link: { task_id: string; project_id: string }) => {
      if (!taskProjectsMap[link.task_id]) taskProjectsMap[link.task_id] = [];
      taskProjectsMap[link.task_id].push(link.project_id);
    });

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
          is_recurring: (t.is_recurring as boolean) || false,
          recurrence_source_task_id: t.recurrence_source_task_id as string | null,
          recurrence_frequency: t.recurrence_frequency as number | null,
          recurrence_unit: t.recurrence_unit as string | null,
          occurrences: [] as { id: string; date: string; status: string }[],
          project_ids: projectIds.filter((pid) => projMap[pid]),
          project_names: projectIds.map((pid) => projMap[pid]).filter(Boolean),
          assignee_ids: aIds,
          assignee_names: aIds.map((eid) => empNameMap[eid]).filter(Boolean),
          contact_id: (t.contact_id as string | null),
          contact_name: contactObj ? `${(contactObj as { first_name: string; last_name: string | null }).first_name}${(contactObj as { last_name: string | null }).last_name ? ` ${(contactObj as { last_name: string | null }).last_name}` : ""}` : null,
        };
      }
    );

    const seriesGroups: Record<string, number[]> = {};
    enriched.forEach((t: any, idx: number) => {
      if (t.recurrence_source_task_id) {
        if (!seriesGroups[t.recurrence_source_task_id]) seriesGroups[t.recurrence_source_task_id] = [];
        seriesGroups[t.recurrence_source_task_id].push(idx);
      }
    });

    const collapsedIds = new Set<string>();
    for (const [sourceId, indices] of Object.entries(seriesGroups)) {
      if (indices.length <= 1) continue;
      const seriesTasks = indices.map((idx) => enriched[idx]);
      seriesTasks.sort((a, b) => {
        const at = a.due_date ? new Date(a.due_date as unknown as string | Date).getTime() : Number.POSITIVE_INFINITY;
        const bt = b.due_date ? new Date(b.due_date as unknown as string | Date).getTime() : Number.POSITIVE_INFINITY;
        return at - bt;
      });
      const occurrences = seriesTasks
        .filter((t) => t.due_date)
        .map((t) => ({ id: t.id, date: t.due_date!, status: t.status }));

      const sourceIdx = enriched.findIndex((t: any) => t.id === sourceId);
      if (sourceIdx >= 0) {
        enriched[sourceIdx].occurrences = occurrences;
        if (seriesTasks[0].due_date) enriched[sourceIdx].start_date = seriesTasks[0].due_date;
        const lastDate = seriesTasks[seriesTasks.length - 1].due_date;
        if (lastDate) enriched[sourceIdx].due_date = lastDate;
        for (const t of seriesTasks) {
          if (t.id !== sourceId) collapsedIds.add(t.id);
        }
      }
    }

    const finalTasks = enriched.filter((t: any) => !collapsedIds.has(t.id)) as GanttTask[];

    const eventData = await fetchGanttEvents();

    if (eventData && eventData.length > 0) {
      const eventAttendeeMap = await fetchGanttEventAttendees(eventData.map((e: { id: string }) => e.id));

      const eventRows: GanttTask[] = eventData.map((e: Record<string, unknown>) => {
        const attIds = (eventAttendeeMap as Record<string, string[]>)[e.id as string] || [];
        const projId = e.project_id as string | null;
        const projName = projId ? (projData || []).find((p: { id: string }) => p.id === projId)?.name : null;
        const contactFirstName = e.contact_first_name as string | null;
        const contactLastName = e.contact_last_name as string | null;
        return {
          id: `event-${e.id}`,
          title: `\u{1F4C5} ${e.title}`,
          status: e.status as string,
          priority: "medium",
          start_date: e.event_date as string,
          due_date: e.event_date as string,
          is_milestone: true,
          project_ids: projId ? [projId] : [],
          project_names: projName ? [projName] : [],
          assignee_ids: attIds,
          assignee_names: attIds.map((aid) => {
            const emp = (empData || []).find((em: { id: string }) => em.id === aid);
            return emp ? employeeName(emp) : "";
          }).filter(Boolean),
          contact_id: e.contact_id as string | null,
          contact_name: contactFirstName ? `${contactFirstName}${contactLastName ? ` ${contactLastName}` : ""}` : null,
          is_recurring: false,
          recurrence_source_task_id: null,
          recurrence_frequency: null,
          recurrence_unit: null,
          occurrences: [],
          is_event: true,
          event_type: e.event_type as string,
        };
      });

      finalTasks.push(...eventRows);
    }

    try {
      const [fedHolidays, customHolidayRows] = await Promise.all([
        getFederalHolidays(),
        fetchCustomHolidays(),
      ]);
      const allHolidays = [
        ...fedHolidays,
        ...(customHolidayRows || []).map((h: { holiday_date: string; name: string }) => ({ date: h.holiday_date, name: h.name })),
      ];
      setHolidayMap(buildHolidayMap(allHolidays));
    } catch {
      // Holidays are non-critical
    }

    setTasks(finalTasks);
    setDependencies((depData || []) as Dependency[]);
    setProjects(projData || []);
    setEmployees(empData || []);
    setLoadError(null);
    } catch (err) {
      console.error("Gantt fetchData failed:", err);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFilterPresets().then(setPresets);
  }, []);

  const getCurrentFilters = useCallback(() => ({
    projects: filterProjects,
    status: filterStatus,
    priority: filterPriority,
    milestoneOnly: filterMilestoneOnly,
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    employee: filterEmployee,
    showEvents,
    showHolidays,
    zoom,
  }), [filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee, showEvents, showHolidays, zoom]);

  const applyPreset = (preset: GanttFilterPreset) => {
    const raw = preset.filters;
    const f: Record<string, any> =
      typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return {}; } })()
        : (raw || {}) as Record<string, any>;
    const asArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    setFilterProjects(asArray(f.projects));
    setFilterStatus(Array.isArray(f.status) ? asArray(f.status) : ["pending", "in_progress", "blocked"]);
    setFilterPriority(asArray(f.priority));
    setFilterMilestoneOnly(!!f.milestoneOnly);
    setFilterDateFrom(typeof f.dateFrom === "string" ? f.dateFrom : "");
    setFilterDateTo(typeof f.dateTo === "string" ? f.dateTo : "");
    setFilterEmployee(asArray(f.employee));
    setShowEvents(f.showEvents !== undefined ? !!f.showEvents : true);
    setShowHolidays(f.showHolidays !== undefined ? !!f.showHolidays : true);
    if (typeof f.zoom === "string" && ["day", "5day", "week", "month", "quarter"].includes(f.zoom)) {
      setZoom(f.zoom as ZoomLevel);
    }
    setActivePresetId(preset.id);
  };

  const handleSavePreset = async () => {
    if (!savePresetName.trim()) return;
    setSavingPreset(true);
    const preset = await saveFilterPreset(savePresetName.trim(), getCurrentFilters());
    setPresets((prev) => [...prev, preset].sort((a, b) => a.name.localeCompare(b.name)));
    setActivePresetId(preset.id);
    setSavePresetName("");
    setSavePresetOpen(false);
    setSavingPreset(false);
  };

  const [updatingPresetId, setUpdatingPresetId] = useState<string | null>(null);
  const [openPresetMenuId, setOpenPresetMenuId] = useState<string | null>(null);

  const handleUpdatePreset = async (id: string) => {
    setUpdatingPresetId(id);
    try {
      const current = getCurrentFilters();
      await updateFilterPreset(id, current);
      setPresets((prev) => prev.map((p) => p.id === id ? { ...p, filters: current } : p));
      setOpenPresetMenuId(null);
    } finally {
      setUpdatingPresetId(null);
    }
  };

  const handleDeletePreset = async (id: string) => {
    await deleteFilterPreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  };

  // Auto-scroll to today's position on initial load
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (!loading && scrollRef.current && !hasScrolledToToday.current) {
      hasScrolledToToday.current = true;
      const colWidth = getColumnWidth();
      // Days from startDate to today
      const now = nowCST();
      const diffMs = now.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let scrollTarget = 0;
      if (zoom === "day") scrollTarget = diffDays * colWidth;
      else if (zoom === "5day") scrollTarget = (diffDays / 5) * colWidth;
      else if (zoom === "week") scrollTarget = (diffDays / 7) * colWidth;
      else if (zoom === "month") scrollTarget = (diffDays / 30) * colWidth;
      else scrollTarget = (diffDays / 90) * colWidth;
      // Offset a bit so today isn't at the very left edge
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget - 200);
    }
  }, [loading]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProjects.length > 0) count++;
    if (filterStatus.length > 0) count++;
    if (filterPriority.length > 0) count++;
    if (filterMilestoneOnly) count++;
    if (filterDateFrom || filterDateTo) count++;
    if (filterEmployee.length > 0) count++;
    return count;
  }, [filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee]);

  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterStatus(["pending", "in_progress", "blocked"]);
    setFilterPriority([]);
    setFilterMilestoneOnly(false);
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterEmployee([]);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterProjects.length > 0) {
        if (filterProjects.includes("__unassigned__")) {
          const realProjects = filterProjects.filter((p) => p !== "__unassigned__");
          const matchesUnassigned = t.project_ids.length === 0;
          const matchesProject = realProjects.length > 0 && t.project_ids.some((pid) => realProjects.includes(pid));
          if (!matchesUnassigned && !matchesProject) return false;
        } else {
          if (!t.project_ids.some((pid) => filterProjects.includes(pid))) return false;
        }
      }

      if (filterStatus.length > 0 && !filterStatus.includes(t.status)) return false;
      if (filterPriority.length > 0 && !filterPriority.includes(t.priority)) return false;
      if (filterMilestoneOnly && !t.is_milestone) return false;
      if (filterDateFrom && t.due_date && t.due_date < filterDateFrom) return false;
      if (filterDateTo && t.start_date && t.start_date > filterDateTo) return false;
      if (filterEmployee.length > 0 && !t.assignee_ids.some((aid) => filterEmployee.includes(aid))) return false;
      if (!showEvents && t.is_event) return false;

      return true;
    });
  }, [tasks, filterProjects, filterStatus, filterPriority, filterMilestoneOnly, filterDateFrom, filterDateTo, filterEmployee, showEvents]);

  const toggleProjectFilter = (projectId: string) => {
    setFilterProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const getColumnWidth = () => {
    if (zoom === "day") return 80;
    if (zoom === "5day") return 110;
    if (zoom === "week") return 120;
    if (zoom === "month") return 160;
    return 200;
  };

  const getDateRange = () => {
    const colWidth = getColumnWidth();
    const numCols =
      zoom === "day" ? 180
      : zoom === "5day" ? 60
      : zoom === "week" ? 52
      : zoom === "month" ? 24
      : 16;
    const dates: Date[] = [];
    const start = new Date(startDate);
    // For 5-day view, snap the first column to the Monday of startDate's week
    if (zoom === "5day") {
      const day = start.getDay(); // 0=Sun..6=Sat
      const offset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + offset);
    }

    for (let i = 0; i < numCols; i++) {
      const d = new Date(start);
      if (zoom === "day") d.setDate(start.getDate() + i);
      else if (zoom === "5day") d.setDate(start.getDate() + i * 5);
      else if (zoom === "week") d.setDate(start.getDate() + i * 7);
      else if (zoom === "month") d.setMonth(start.getMonth() + i);
      else d.setMonth(start.getMonth() + i * 3);
      dates.push(d);
    }

    return { dates, colWidth, totalWidth: numCols * colWidth };
  };

  const { dates, colWidth, totalWidth } = getDateRange();

  const rangeStart = dates[0];
  const rangeEnd = new Date(dates[dates.length - 1]);
  if (zoom === "day") rangeEnd.setDate(rangeEnd.getDate() + 1);
  else if (zoom === "5day") rangeEnd.setDate(rangeEnd.getDate() + 5);
  else if (zoom === "week") rangeEnd.setDate(rangeEnd.getDate() + 7);
  else if (zoom === "quarter") rangeEnd.setMonth(rangeEnd.getMonth() + 3);
  else rangeEnd.setMonth(rangeEnd.getMonth() + 1);

  const dateToX = (dateStr: string | Date) => {
    const parsed = parseForDisplay(dateStr);
    const d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (zoom === "day" || zoom === "week" || zoom === "5day") {
      const totalMs = rangeEnd.getTime() - rangeStart.getTime();
      const elapsedMs = d.getTime() - rangeStart.getTime();
      return (elapsedMs / totalMs) * totalWidth;
    }
    // month / quarter: columns are equal width but months vary in length —
    // find the containing column and interpolate proportionally within it.
    for (let i = 0; i < dates.length; i++) {
      const colStart = dates[i];
      const colEnd = new Date(colStart);
      if (zoom === "month") colEnd.setMonth(colEnd.getMonth() + 1);
      else colEnd.setMonth(colEnd.getMonth() + 3);
      if (d.getTime() >= colStart.getTime() && d.getTime() < colEnd.getTime()) {
        const frac =
          (d.getTime() - colStart.getTime()) /
          (colEnd.getTime() - colStart.getTime());
        return i * colWidth + frac * colWidth;
      }
    }
    if (d.getTime() < rangeStart.getTime()) {
      const daysBefore = (rangeStart.getTime() - d.getTime()) / 86400000;
      return -daysBefore * (colWidth / 30);
    }
    return totalWidth + 1;
  };

  // Due dates are inclusive — treat bar end as the start of the following day
  // so a task ending on Fri 04/23 visually covers all of Friday.
  const dueDateToX = (dateStr: string | Date) => {
    const parsed = parseForDisplay(dateStr);
    const d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    d.setDate(d.getDate() + 1);
    return dateToX(d);
  };

  const todayX = dateToX(nowCST().toISOString());

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

  const taskRowMap: Record<string, number> = {};
  const taskXMap: Record<string, { x: number; w: number }> = {};
  let rowIndex = 0;
  for (const row of allRows) {
    if (row.type === "task" && row.task && !taskRowMap.hasOwnProperty(row.task.id)) {
      taskRowMap[row.task.id] = rowIndex;
      if (row.task.start_date && row.task.due_date) {
        const x1 = dateToX(row.task.start_date);
        const x2 = dueDateToX(row.task.due_date);
        taskXMap[row.task.id] = { x: Math.max(x1, 0), w: Math.max(x2 - x1, 8) };
      }
    }
    rowIndex++;
  }

  const navigate = (dir: number) => {
    const d = new Date(startDate);
    if (zoom === "day") d.setDate(d.getDate() + dir * 14);
    else if (zoom === "5day") d.setDate(d.getDate() + dir * 20);
    else if (zoom === "week") d.setDate(d.getDate() + dir * 28);
    else if (zoom === "quarter") d.setMonth(d.getMonth() + dir * 6);
    else d.setMonth(d.getMonth() + dir * 3);
    setStartDate(d);
  };

  const formatHeader = (d: Date) => {
    const toStr = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (zoom === "day") return formatDateShort(toStr(d));
    if (zoom === "5day") {
      const end = new Date(d);
      end.setDate(end.getDate() + 4);
      return `${formatDateShort(toStr(d))} - ${formatDateShort(toStr(end))}`;
    }
    if (zoom === "week") {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatDate(toStr(d))} - ${formatDate(toStr(end))}`;
    }
    if (zoom === "quarter") {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `Q${quarter} ${d.getFullYear()}`;
    }
    return formatDate(toStr(d));
  };

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
  if (filterStatus.length > 0) {
    filterBadges.push({
      label: `Status: ${filterStatus.map((s) => s.replace("_", " ")).join(", ")}`,
      onRemove: () => setFilterStatus([]),
    });
  }
  if (filterPriority.length > 0) {
    filterBadges.push({
      label: `Priority: ${filterPriority.join(", ")}`,
      onRemove: () => setFilterPriority([]),
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
  if (filterEmployee.length > 0) {
    const names = filterEmployee.map((eid) => {
      const emp = employees.find((e) => e.id === eid);
      return emp ? employeeName(emp) : eid;
    });
    filterBadges.push({
      label: `Employee: ${names.join(", ")}`,
      onRemove: () => setFilterEmployee([]),
    });
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (loadError) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold text-red-600">Failed to load Gantt chart</h1>
        <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </pre>
        <Button
          onClick={() => {
            setLoadError(null);
            setLoading(true);
            fetchData();
          }}
        >
          Retry
        </Button>
      </div>
    );
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
              const d = nowCST();
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
              <SelectItem value="5day">5-Day (Mon–Fri)</SelectItem>
              <SelectItem value="week">Week (7-Day)</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtersOpen && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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

              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start h-9 text-sm">
                      {filterStatus.length > 0
                        ? `${filterStatus.length} selected`
                        : "All Statuses"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {[
                        { value: "pending", label: "Pending" },
                        { value: "in_progress", label: "In Progress" },
                        { value: "completed", label: "Completed" },
                        { value: "cancelled", label: "Cancelled" },
                        { value: "blocked", label: "Blocked" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={filterStatus.includes(opt.value)}
                            onCheckedChange={() => {
                              setFilterStatus((prev) =>
                                prev.includes(opt.value)
                                  ? prev.filter((v) => v !== opt.value)
                                  : [...prev, opt.value]
                              );
                            }}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Priority</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start h-9 text-sm">
                      {filterPriority.length > 0
                        ? `${filterPriority.length} selected`
                        : "All Priorities"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {[
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                        { value: "urgent", label: "Urgent" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={filterPriority.includes(opt.value)}
                            onCheckedChange={() => {
                              setFilterPriority((prev) =>
                                prev.includes(opt.value)
                                  ? prev.filter((v) => v !== opt.value)
                                  : [...prev, opt.value]
                              );
                            }}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Employee</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start h-9 text-sm">
                      {filterEmployee.length > 0
                        ? `${filterEmployee.length} selected`
                        : "All Employees"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {employees.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={filterEmployee.includes(e.id)}
                            onCheckedChange={() => {
                              setFilterEmployee((prev) =>
                                prev.includes(e.id)
                                  ? prev.filter((v) => v !== e.id)
                                  : [...prev, e.id]
                              );
                            }}
                          />
                          <span className="text-sm">{employeeName(e)}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Date From</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
                {filterDateFrom && (
                  <span className="text-xs text-muted-foreground">{formatDate(filterDateFrom)}</span>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Date To</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
                {filterDateTo && (
                  <span className="text-xs text-muted-foreground">{formatDate(filterDateTo)}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filterMilestoneOnly}
                    onCheckedChange={(checked) => setFilterMilestoneOnly(!!checked)}
                  />
                  <span className="text-sm">Show only milestones</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={showEvents}
                    onCheckedChange={(checked) => setShowEvents(!!checked)}
                  />
                  <span className="text-sm">Show events</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={showHolidays}
                    onCheckedChange={(checked) => setShowHolidays(!!checked)}
                  />
                  <span className="text-sm">Show holidays</span>
                </label>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear All Filters
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Saved Views</span>
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center">
                    <Button
                      variant={activePresetId === preset.id ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs rounded-r-none"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.name}
                    </Button>
                    <Popover
                      open={openPresetMenuId === preset.id}
                      onOpenChange={(open) => setOpenPresetMenuId(open ? preset.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant={activePresetId === preset.id ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-1 rounded-l-none border-l-0"
                        >
                          {updatingPresetId === preset.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-36 p-1" align="start">
                        <button
                          className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer w-full text-left text-sm disabled:opacity-50"
                          disabled={updatingPresetId === preset.id}
                          onClick={() => handleUpdatePreset(preset.id)}
                        >
                          {updatingPresetId === preset.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                          {updatingPresetId === preset.id ? "Updating..." : "Update"}
                        </button>
                        <button
                          className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer w-full text-left text-sm text-destructive"
                          onClick={() => handleDeletePreset(preset.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSavePresetName("");
                    setSavePresetOpen(true);
                  }}
                >
                  <Save className="mr-1 h-3 w-3" />
                  Save Current View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSavePreset(); }}>
            <DialogHeader>
              <DialogTitle>Save Filter View</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="preset_name">View Name</Label>
              <Input
                id="preset_name"
                className="mt-2"
                placeholder="e.g. Active Sprint, My Tasks..."
                value={savePresetName}
                onChange={(e) => setSavePresetName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPreset || !savePresetName.trim()}>
                {savingPreset ? "Saving..." : "Save View"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            Showing {filteredTasks.filter((t) => t.start_date && t.due_date && !t.is_event).length} tasks
            {filteredTasks.filter((t) => t.is_event).length > 0 && ` + ${filteredTasks.filter((t) => t.is_event).length} events`}
            {" "}of {tasks.filter((t) => !t.is_event).length} total tasks
            {(() => {
              const noDates = filteredTasks.filter((t) => !t.start_date || !t.due_date);
              if (noDates.length === 0) return null;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <span className="ml-1 text-orange-600 underline decoration-dotted cursor-pointer hover:text-orange-700">
                      ({noDates.length} without dates)
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tasks without dates:</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {noDates.map((t) => (
                        <div
                          key={t.id}
                          className="text-sm text-blue-600 hover:underline cursor-pointer truncate"
                          onClick={() => router.push(t.is_event ? `/dashboard/events/${t.id}` : `/dashboard/tasks/${t.id}`)}
                        >
                          {t.title}
                          {!t.start_date && !t.due_date
                            ? <span className="text-xs text-muted-foreground ml-1">(no dates)</span>
                            : !t.start_date
                            ? <span className="text-xs text-muted-foreground ml-1">(no start)</span>
                            : <span className="text-xs text-muted-foreground ml-1">(no due)</span>}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
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
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b bg-muted/20">
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
                <span className="text-xs text-muted-foreground ml-4">Bar types:</span>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-8 rounded bg-blue-500 border-l-4 border-blue-700" />
                  <span className="text-xs">Regular</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm z-10" />
                    <div className="h-0.5 w-2 bg-blue-200" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white shadow-sm z-10" />
                  </div>
                  <span className="text-xs">Recurring</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 bg-purple-500 rotate-45 border border-purple-700" />
                  <span className="text-xs ml-0.5">Event</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-5 bg-emerald-100 border border-emerald-400 rounded-sm" />
                  <span className="text-xs">Holiday</span>
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
              <div className="max-h-[70vh] overflow-auto relative" ref={scrollRef}>
                <div className="flex min-w-max">
                <div className="shrink-0 border-r sticky left-0 z-30 bg-background relative" style={{ width: nameColWidth }}>
                  <div className="h-10 border-b bg-muted/50 flex items-center px-3 sticky top-0 z-40">
                    <span className="text-xs font-medium text-muted-foreground">Task</span>
                  </div>
                  <div
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 hover:bg-blue-400/40 active:bg-blue-500/50 transition-colors"
                    onMouseDown={handleResizeMouseDown}
                  />
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
                          router.push(row.task.is_event ? `/dashboard/events/${row.task.id}` : `/dashboard/tasks/${row.task.id}`);
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
                              className="flex items-center gap-2 w-full min-w-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className={`h-2.5 w-2.5 shrink-0 ${
                                  row.task?.is_event
                                    ? "bg-purple-500 rotate-45"
                                    : `rounded-full ${STATUS_COLORS[row.task?.status || ""] || "bg-gray-400"}`
                                }`}
                              />
                              <span className="truncate shrink-0 max-w-[45%]">{row.label}</span>
                              {(row.task?.occurrences?.length ?? 0) > 1 && (
                                <RefreshCw className="h-3 w-3 shrink-0 text-blue-500" />
                              )}
                              {row.task?.contact_name && (
                                <span
                                  className="truncate text-xs text-muted-foreground shrink min-w-0"
                                  title={`Contact: ${row.task.contact_name}`}
                                >
                                  · {row.task.contact_name}
                                </span>
                              )}
                              {row.task && row.task.assignee_names.length > 0 && (
                                <span
                                  className="truncate text-xs text-blue-600/80 shrink min-w-0"
                                  title={`Employees: ${row.task.assignee_names.join(", ")}`}
                                >
                                  · {row.task.assignee_names.join(", ")}
                                </span>
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="start" side="right">
                            {row.task!.is_event ? (
                              <div className="space-y-2">
                                <div
                                  className="font-medium text-sm text-purple-600 hover:underline cursor-pointer"
                                  onClick={() => router.push(`/dashboard/events/${row.task!.id}`)}
                                >
                                  {row.task!.title}
                                </div>
                                <div className="text-xs space-y-1.5">
                                  <div>
                                    <span className="text-muted-foreground">Type: </span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{row.task!.event_type}</Badge>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Date: </span>
                                    <span>{formatDateLong(row.task!.start_date!)}</span>
                                  </div>
                                  {row.task!.contact_name && (
                                    <div>
                                      <span className="text-muted-foreground">Contact: </span>
                                      <span
                                        className="text-blue-600 hover:underline cursor-pointer"
                                        onClick={() => router.push(`/dashboard/contacts/${row.task!.contact_id}`)}
                                      >
                                        {row.task!.contact_name}
                                      </span>
                                    </div>
                                  )}
                                  {row.task!.assignee_names.length > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Employees: </span>
                                      <span>{row.task!.assignee_names.join(", ")}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
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
                                    <span className="text-muted-foreground">Employees: </span>
                                    {row.task!.assignee_names.length > 0 ? (
                                      <span>{row.task!.assignee_names.join(", ")}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </div>
                                  {(row.task!.occurrences?.length ?? 0) > 1 && (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <RefreshCw className="h-3 w-3 shrink-0" />
                                      <span>
                                        {row.task!.occurrences.length} occurrences
                                        {row.task!.recurrence_frequency && row.task!.recurrence_unit && (
                                          <> (every {row.task!.recurrence_frequency} {row.task!.recurrence_unit})</>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex-1">
                  <div className="flex h-10 border-b bg-muted/50 sticky top-0 z-20" style={{ width: totalWidth }}>
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

                  <div className="relative" style={{ width: totalWidth, height: allRows.length * ROW_HEIGHT }}>
                    {dates.map((_, i) => (
                      <div
                        key={`grid-${i}`}
                        className="absolute top-0 bottom-0 border-r border-dashed border-muted"
                        style={{ left: i * colWidth }}
                      />
                    ))}

                    {allRows.map((row, i) => (
                      <div
                        key={`row-${row.rowKey}`}
                        className={`absolute left-0 right-0 border-b ${
                          row.type === "header" ? "bg-muted/20" : ""
                        }`}
                        style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                      />
                    ))}

                    {showHolidays && Object.entries(holidayMap).map(([dateStr, names]) => {
                      const hx = dateToX(dateStr);
                      if (hx < -20 || hx > totalWidth + 20) return null;
                      const bandWidth = zoom === "day" ? colWidth : zoom === "5day" ? Math.max(colWidth / 5, 4) : zoom === "week" ? Math.max(colWidth / 7, 4) : Math.max(colWidth / 30, 4);
                      return (
                        <div key={`holiday-${dateStr}`}>
                          <div
                            className="absolute top-0 bottom-0 bg-emerald-100/50 z-[1]"
                            style={{ left: hx, width: bandWidth }}
                            title={names.join(", ")}
                          />
                          <div
                            className="absolute top-0 w-0.5 bottom-0 bg-emerald-400/60 z-[2]"
                            style={{ left: hx }}
                          />
                          <div
                            className="absolute z-[15] -translate-x-1/2 top-1 pointer-events-none"
                            style={{ left: hx + bandWidth / 2 }}
                          >
                            <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 whitespace-nowrap shadow-sm">
                              {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}

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

                    {allRows.map((row, i) => {
                      if (row.type !== "task" || !row.task || !row.task.start_date || !row.task.due_date) return null;
                      const task = row.task;
                      const x1 = dateToX(task.start_date!);
                      const x2 = dueDateToX(task.due_date!);
                      const barX = Math.max(x1, 0);
                      const barW = Math.max(x2 - x1, 8);
                      const barY = i * ROW_HEIGHT + 10;
                      const barH = ROW_HEIGHT - 20;

                      if (task.is_event) {
                        const diamondSize = 14;
                        const cx = dateToX(task.start_date!);
                        const cy = i * ROW_HEIGHT + ROW_HEIGHT / 2;
                        return (
                          <div
                            key={`bar-${row.rowKey}`}
                            className="absolute bg-purple-500 rotate-45 cursor-pointer transition-transform hover:scale-125 z-10 border border-purple-700 shadow-sm"
                            style={{
                              left: cx - diamondSize / 2,
                              top: cy - diamondSize / 2,
                              width: diamondSize,
                              height: diamondSize,
                            }}
                            title={`${task.title} (${task.event_type})\n${formatDateLong(task.start_date!)}`}
                            onClick={() => router.push(`/dashboard/events/${task.id}`)}
                          />
                        );
                      }

                      if ((task.occurrences?.length ?? 0) > 1) {
                        return (
                          <div key={`bar-${row.rowKey}`}>
                            <div
                              className="absolute rounded bg-blue-50 border border-blue-300 border-dashed"
                              style={{ left: barX, width: barW, top: barY, height: barH }}
                              title={`${task.title} — Recurring series (${task.occurrences.length} occurrences)\nStart: ${formatDateLong(task.start_date!)}\nEnd: ${formatDateLong(task.due_date!)}${task.recurrence_frequency && task.recurrence_unit ? `\nEvery ${task.recurrence_frequency} ${task.recurrence_unit}` : ""}`}
                            />
                            <div
                              className="absolute bg-blue-200"
                              style={{ left: barX, width: barW, top: barY + barH / 2 - 1, height: 2 }}
                            />
                            {task.occurrences.map((occ, j) => {
                              const occX = dateToX(occ.date);
                              const markerSize = 12;
                              return (
                                <div
                                  key={`occ-${occ.id}`}
                                  className={`absolute rounded-full cursor-pointer transition-transform hover:scale-150 z-10 border-2 border-white shadow-sm ${STATUS_COLORS[occ.status] || "bg-gray-400"}`}
                                  style={{
                                    left: occX - markerSize / 2,
                                    top: barY + (barH - markerSize) / 2,
                                    width: markerSize,
                                    height: markerSize,
                                  }}
                                  title={`Occurrence ${j + 1} of ${task.occurrences.length}\n${formatDateLong(occ.date)}\nStatus: ${occ.status.replace("_", " ")}`}
                                  onClick={() => router.push(`/dashboard/tasks/${occ.id}`)}
                                />
                              );
                            })}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`bar-${row.rowKey}`}
                          className={`absolute rounded cursor-pointer transition-opacity hover:opacity-80 border-l-4 ${
                            STATUS_COLORS[task.status] || "bg-gray-400"
                          } ${PRIORITY_BORDER[task.priority] || "border-slate-300"}`}
                          style={{ left: barX, width: barW, top: barY, height: barH }}
                          title={`${task.title} (${task.status})\nStart: ${formatDateLong(task.start_date!)}\nEnd: ${formatDateLong(task.due_date!)}${task.contact_name ? `\nContact: ${task.contact_name}` : ""}${task.assignee_names.length > 0 ? `\nEmployees: ${task.assignee_names.join(", ")}` : ""}${task.project_names.length > 0 ? `\nProjects: ${task.project_names.join(", ")}` : ""}`}
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                        />
                      );
                    })}

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
              </div>

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

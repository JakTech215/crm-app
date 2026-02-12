"use client";

import { useEffect, useState, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
}

interface Dependency {
  task_id: string;
  depends_on_task_id: string;
}

interface Project {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const fetchData = async () => {
    const [{ data: taskData }, { data: depData }, { data: projData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, priority, start_date, due_date, project_id")
        .order("project_id")
        .order("start_date"),
      supabase.from("task_dependencies").select("task_id, depends_on_task_id"),
      supabase.from("projects").select("id, name").order("name"),
    ]);

    // Enrich tasks with project names
    const projMap: Record<string, string> = {};
    (projData || []).forEach((p: Project) => { projMap[p.id] = p.name; });

    const enriched = (taskData || []).map((t: Omit<GanttTask, "project_name">) => ({
      ...t,
      project_name: t.project_id ? projMap[t.project_id] || null : null,
    }));

    setTasks(enriched);
    setDependencies(depData || []);
    setProjects(projData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  // Group tasks by project
  const grouped: { project: string | null; tasks: GanttTask[] }[] = [];
  const projectGroups = new Map<string | null, GanttTask[]>();
  for (const t of tasks) {
    const key = t.project_name || null;
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(t);
  }
  // Projects first, then unassigned
  for (const p of projects) {
    if (projectGroups.has(p.name)) {
      grouped.push({ project: p.name, tasks: projectGroups.get(p.name)! });
    }
  }
  if (projectGroups.has(null)) {
    grouped.push({ project: null, tasks: projectGroups.get(null)! });
  }

  const allRows: { type: "header" | "task"; label: string; task?: GanttTask }[] = [];
  for (const g of grouped) {
    allRows.push({ type: "header", label: g.project || "No Project" });
    for (const t of g.tasks) {
      allRows.push({ type: "task", label: t.title, task: t });
    }
  }

  const ROW_HEIGHT = 40;

  // Build task position map for dependency arrows
  const taskRowMap: Record<string, number> = {};
  const taskXMap: Record<string, { x: number; w: number }> = {};
  let rowIndex = 0;
  for (const row of allRows) {
    if (row.type === "task" && row.task) {
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

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gantt Chart</h1>
          <p className="text-muted-foreground">
            Visual timeline of tasks and dependencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {tasks.filter((t) => t.start_date && t.due_date).length} tasks with dates shown.
            {tasks.filter((t) => !t.start_date || !t.due_date).length > 0 && (
              <span className="ml-1 text-orange-600">
                {tasks.filter((t) => !t.start_date || !t.due_date).length} tasks without dates (not shown).
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex">
            {/* Left panel: task labels */}
            <div className="w-56 shrink-0 border-r">
              {/* Header row */}
              <div className="h-10 border-b bg-muted/50 flex items-center px-3">
                <span className="text-xs font-medium text-muted-foreground">Task</span>
              </div>
              {allRows.map((row, i) => (
                <div
                  key={i}
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
                    <span className="truncate">{row.label}</span>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          STATUS_COLORS[row.task?.status || ""] || "bg-gray-400"
                        }`}
                      />
                      <span className="truncate">{row.label}</span>
                    </div>
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
                    key={`row-${i}`}
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
                      key={`bar-${row.task.id}`}
                      className={`absolute rounded cursor-pointer transition-opacity hover:opacity-80 border-l-4 ${
                        STATUS_COLORS[row.task.status] || "bg-gray-400"
                      } ${PRIORITY_BORDER[row.task.priority] || "border-slate-300"}`}
                      style={{
                        left: barX,
                        width: barW,
                        top: i * ROW_HEIGHT + 10,
                        height: ROW_HEIGHT - 20,
                      }}
                      title={`${row.task.title} (${row.task.status})`}
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

                    return (
                      <g key={`dep-${dep.task_id}-${dep.depends_on_task_id}`}>
                        <path
                          d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                        />
                        {/* Arrow head */}
                        <polygon
                          points={`${toX},${toY} ${toX - 6},${toY - 4} ${toX - 6},${toY + 4}`}
                          fill="#94a3b8"
                        />
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
        </CardContent>
      </Card>
    </div>
  );
}

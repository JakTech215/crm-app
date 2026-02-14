"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Trash2, Plus, X, Search } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string | null;
  department: string | null;
  status: string;
  created_at: string;
}

const employeeName = (e: { first_name: string; last_name: string }) =>
  `${e.first_name} ${e.last_name}`;

interface AssignedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  contact_id: string | null;
  contacts: { first_name: string; last_name: string | null; company: string | null } | null;
}

interface TaskWithProject extends AssignedTask {
  projectName: string | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const taskStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function EmployeeDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    department: "",
    status: "active",
  });

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteCheckOpen, setDeleteCheckOpen] = useState(false);
  const [assignedTasks, setAssignedTasks] = useState<{ id: string; title: string }[]>([]);

  // Tasks state
  const [empTasks, setEmpTasks] = useState<TaskWithProject[]>([]);
  const [allTasks, setAllTasks] = useState<{ id: string; title: string }[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [removeTaskId, setRemoveTaskId] = useState<string | null>(null);

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();
    setEmployee(data);
    setLoading(false);
  };

  const fetchEmployeeTasks = async () => {
    setTasksLoading(true);
    // Get task IDs assigned to this employee
    const { data: assignments } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("employee_id", employeeId);

    if (!assignments || assignments.length === 0) {
      setEmpTasks([]);
      setTasksLoading(false);
      return;
    }

    const taskIds = assignments.map((a: { task_id: string }) => a.task_id);

    // Fetch full task details with contacts
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, start_date, due_date, contact_id, contacts:contact_id(first_name, last_name, company)")
      .in("id", taskIds)
      .order("due_date", { ascending: true });

    // Fetch project links for these tasks
    const { data: projectLinks } = await supabase
      .from("project_tasks")
      .select("task_id, project_id")
      .in("task_id", taskIds);

    const projectNameMap: Record<string, string> = {};
    if (projectLinks && projectLinks.length > 0) {
      const projectIds = [...new Set(projectLinks.map((pl: { project_id: string }) => pl.project_id))];
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (projects) {
        for (const p of projects) projectNameMap[p.id] = p.name;
      }
    }

    const taskProjectMap: Record<string, string> = {};
    if (projectLinks) {
      for (const pl of projectLinks as { task_id: string; project_id: string }[]) {
        if (projectNameMap[pl.project_id]) {
          taskProjectMap[pl.task_id] = projectNameMap[pl.project_id];
        }
      }
    }

    const tasksWithProjects: TaskWithProject[] = (tasks || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      title: t.title as string,
      status: t.status as string,
      priority: t.priority as string,
      start_date: t.start_date as string | null,
      due_date: t.due_date as string | null,
      contact_id: t.contact_id as string | null,
      contacts: t.contacts as AssignedTask["contacts"],
      projectName: taskProjectMap[t.id as string] || null,
    }));

    setEmpTasks(tasksWithProjects);
    setTasksLoading(false);
  };

  const fetchAllTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title")
      .neq("status", "completed")
      .order("title");
    setAllTasks(data || []);
  };

  const handleAssignTask = async (taskId: string) => {
    await supabase.from("task_assignees").insert({
      task_id: taskId,
      employee_id: employeeId,
    });
    fetchEmployeeTasks();
    fetchAllTasks();
  };

  const handleRemoveAssignment = async (taskId: string) => {
    await supabase.from("task_assignees").delete().eq("task_id", taskId).eq("employee_id", employeeId);
    setRemoveTaskId(null);
    fetchEmployeeTasks();
  };

  useEffect(() => {
    fetchEmployee();
    fetchEmployeeTasks();
    fetchAllTasks();
  }, [employeeId]);

  const openEditDialog = () => {
    if (!employee) return;
    setEditForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      role: employee.role || "",
      department: employee.department || "",
      status: employee.status,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    const { error } = await supabase
      .from("employees")
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        role: editForm.role || null,
        department: editForm.department || null,
        status: editForm.status,
      })
      .eq("id", employeeId);

    if (error) {
      setEditError(error.message);
      setSavingEdit(false);
      return;
    }

    setEditOpen(false);
    fetchEmployee();
    setSavingEdit(false);
  };

  const checkDependenciesAndDelete = async () => {
    const { data: assignments } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("employee_id", employeeId);

    if (assignments && assignments.length > 0) {
      const taskIds = assignments.map((a: { task_id: string }) => a.task_id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", taskIds);
      setAssignedTasks(tasks || []);
    } else {
      setAssignedTasks([]);
    }
    setDeleteCheckOpen(true);
  };

  const handleDeleteEmployee = async () => {
    setDeleting(true);
    await supabase.from("task_assignees").delete().eq("employee_id", employeeId);
    const { error } = await supabase.from("employees").delete().eq("id", employeeId);
    if (!error) {
      router.push("/dashboard/employees");
    }
    setDeleting(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const statusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-800";
    if (status === "on_leave") return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  // Task stats
  const taskStats = {
    total: empTasks.length,
    pending: empTasks.filter((t) => t.status === "pending").length,
    in_progress: empTasks.filter((t) => t.status === "in_progress").length,
    completed: empTasks.filter((t) => t.status === "completed").length,
    overdue: empTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      return new Date(t.due_date) < new Date();
    }).length,
  };

  // Filter and sort tasks
  const filteredTasks = empTasks
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (taskSearch) {
        const q = taskSearch.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "due_date") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === "priority") {
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

  // Tasks available to assign (not already assigned)
  const assignedTaskIds = new Set(empTasks.map((t) => t.id));
  const availableTasks = allTasks.filter((t) => !assignedTaskIds.has(t.id));

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!employee) {
    return <div className="p-6">Employee not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {employeeName(employee)}
            </h1>
            <p className="text-muted-foreground">Employee details</p>
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
            onClick={checkDependenciesAndDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <AlertDialog open={deleteCheckOpen} onOpenChange={setDeleteCheckOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to delete &quot;{employeeName(employee)}&quot;? This action cannot be undone.
                    </p>
                    {assignedTasks.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Assigned Tasks ({assignedTasks.length}):</p>
                        <ul className="list-disc pl-4 text-sm">
                          {assignedTasks.map((t) => (
                            <li key={t.id}>{t.title}</li>
                          ))}
                        </ul>
                        <p className="text-xs mt-1">This employee will be unassigned from these tasks.</p>
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteEmployee}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
              <DialogDescription>
                Update this employee&apos;s information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_first_name">First Name *</Label>
                  <Input
                    id="edit_first_name"
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_last_name">Last Name *</Label>
                  <Input
                    id="edit_last_name"
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_email">Email *</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_role">Role</Label>
                <Input
                  id="edit_role"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  placeholder="e.g. Developer, Designer, Manager"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_department">Department</Label>
                <Input
                  id="edit_department"
                  value={editForm.department}
                  onChange={(e) =>
                    setEditForm({ ...editForm, department: e.target.value })
                  }
                  placeholder="e.g. Engineering, Marketing, Sales"
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
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

      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="mt-1">{employee.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p className="mt-1">{employee.role || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Department
              </p>
              <p className="mt-1">{employee.department || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <Badge
                variant="secondary"
                className={`mt-1 capitalize ${statusColor(employee.status)}`}
              >
                {employee.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Created</p>
            <p className="mt-1">{formatDate(employee.created_at)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assigned Tasks</CardTitle>
            <CardDescription>
              Tasks assigned to {employeeName(employee)}.
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Assign Task
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end">
              {availableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No tasks available to assign.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {availableTasks.map((t) => (
                    <button
                      key={t.id}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer w-full text-left text-sm"
                      onClick={() => handleAssignTask(t.id)}
                    >
                      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          {empTasks.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{taskStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{taskStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{taskStats.in_progress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{taskStats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          )}

          {/* Filters */}
          {empTasks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Sort by Due Date</SelectItem>
                  <SelectItem value="priority">Sort by Priority</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tasks Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {empTasks.length === 0
                      ? "No tasks assigned. Click \"Assign Task\" to get started."
                      : "No tasks match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date) < new Date();
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <span
                          className="font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                        >
                          {task.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.projectName || <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>
                      <TableCell>
                        {task.contacts ? (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => router.push(`/dashboard/contacts/${task.contact_id}`)}
                          >
                            {contactName(task.contacts)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`capitalize ${taskStatusColors[task.status] || ""}`}
                        >
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`capitalize ${priorityColors[task.priority] || ""}`}
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.start_date
                          ? new Date(task.start_date).toLocaleDateString()
                          : <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div>
                            <span className={`text-sm ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                            {isOverdue && (
                              <p className="text-xs text-red-600">Overdue</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setRemoveTaskId(task.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Remove assignment confirmation */}
      <AlertDialog open={!!removeTaskId} onOpenChange={(open) => !open && setRemoveTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {employeeName(employee)} from task &quot;{empTasks.find((t) => t.id === removeTaskId)?.title}&quot;? This will not delete the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTaskId && handleRemoveAssignment(removeTaskId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

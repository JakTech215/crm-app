"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { todayCST, formatDate } from "@/lib/dates";

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

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string | null;
}

export default function EmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [employeeTasksMap, setEmployeeTasksMap] = useState<Record<string, UpcomingTask[]>>({});
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    department: "",
    status: "active",
  });

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    setEmployees(data || []);
    setLoading(false);
  };

  const fetchEmployeeTasks = async () => {
    const today = todayCST();
    const { data: assignments } = await supabase
      .from("task_assignees")
      .select("task_id, employee_id");

    if (!assignments || assignments.length === 0) return;

    const taskIds = [...new Set(assignments.map((a: { task_id: string }) => a.task_id))];

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date")
      .in("id", taskIds)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .gte("due_date", today)
      .order("due_date", { ascending: true });

    const taskById: Record<string, UpcomingTask> = {};
    for (const t of (tasks || []) as UpcomingTask[]) taskById[t.id] = t;

    const raw: Record<string, UpcomingTask[]> = {};
    for (const a of assignments as { task_id: string; employee_id: string }[]) {
      const task = taskById[a.task_id];
      if (!task) continue;
      if (!raw[a.employee_id]) raw[a.employee_id] = [];
      raw[a.employee_id].push(task);
    }

    const map: Record<string, UpcomingTask[]> = {};
    for (const [empId, empTasks] of Object.entries(raw)) {
      map[empId] = empTasks
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
        .slice(0, 3);
    }
    setEmployeeTasksMap(map);
  };

  useEffect(() => {
    fetchEmployees();
    fetchEmployeeTasks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("employees").insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      role: form.role || null,
      department: form.department || null,
      status: form.status,
      created_by: user?.id,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm({
      first_name: "",
      last_name: "",
      email: "",
      role: "",
      department: "",
      status: "active",
    });
    setOpen(false);
    fetchEmployees();
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">
          {statusFilter === "all" ? "All Employees" : "Active Employees"}
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
                <DialogDescription>
                  Add a new team member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value })
                    }
                    placeholder="e.g. Developer, Designer, Manager"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                    placeholder="e.g. Engineering, Marketing, Sales"
                  />
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Add Employee"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {statusFilter === "all" ? "All Employees" : `${statusFilter.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Employees`}
              </CardTitle>
              <CardDescription>
                Your organization&apos;s team members.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Upcoming Tasks</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : employees.filter((emp) => {
                if (statusFilter !== "all" && emp.status !== statusFilter) return false;
                const q = search.toLowerCase();
                return !q || employeeName(emp).toLowerCase().includes(q) ||
                  emp.email.toLowerCase().includes(q) ||
                  emp.role?.toLowerCase().includes(q) ||
                  emp.department?.toLowerCase().includes(q);
              }).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No employees yet. Click &quot;Add Employee&quot; to add
                    one.
                  </TableCell>
                </TableRow>
              ) : (
                employees.filter((emp) => {
                  if (statusFilter !== "all" && emp.status !== statusFilter) return false;
                  const q = search.toLowerCase();
                  return !q || employeeName(emp).toLowerCase().includes(q) ||
                    emp.email.toLowerCase().includes(q) ||
                    emp.role?.toLowerCase().includes(q) ||
                    emp.department?.toLowerCase().includes(q);
                }).map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                  >
                    <TableCell className="font-medium">
                      {employeeName(employee)}
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.role || "—"}</TableCell>
                    <TableCell>{employee.department || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(employeeTasksMap[employee.id] || []).length > 0 ? (
                        <div className="space-y-1">
                          {employeeTasksMap[employee.id].map((t) => (
                            <div
                              key={t.id}
                              className="text-xs cursor-pointer hover:underline text-primary truncate max-w-[200px]"
                              onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                            >
                              {t.title}
                              {t.due_date && (
                                <span className="text-muted-foreground ml-1">
                                  ({formatDate(t.due_date)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize ${
                          employee.status === "active"
                            ? "bg-green-100 text-green-800"
                            : employee.status === "on_leave"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {employee.status.replace("_", " ")}
                      </Badge>
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

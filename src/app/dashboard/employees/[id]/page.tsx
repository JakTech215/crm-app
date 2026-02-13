"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

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

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();
    setEmployee(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployee();
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
    </div>
  );
}

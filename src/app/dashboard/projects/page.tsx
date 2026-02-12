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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
}

const contactName = (c: { first_name: string; last_name: string | null }) =>
  `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`;

interface Project {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
  contact_id: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  contacts: Contact | null;
}

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

const FALLBACK_STATUSES: StatusOption[] = [
  { id: "planning", name: "Planning", color: "blue" },
  { id: "active", name: "Active", color: "green" },
  { id: "on_hold", name: "On Hold", color: "yellow" },
  { id: "completed", name: "Completed", color: "gray" },
];

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

export default function ProjectsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<StatusOption[]>(FALLBACK_STATUSES);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    client: "",
    contact_id: "",
    status: "planning",
    start_date: "",
    due_date: "",
  });

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*, contacts:contact_id(id, first_name, last_name)")
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name");
    setContacts(data || []);
  };

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from("project_statuses")
      .select("id, name, color")
      .order("name");
    if (data && data.length > 0) {
      setProjectStatuses(data);
      setForm((f) => ({ ...f, status: data[0].name }));
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchContacts();
    fetchStatuses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("projects").insert({
      name: form.name,
      description: form.description || null,
      client: form.client || null,
      contact_id: form.contact_id || null,
      status: form.status,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      user_id: user?.id,
    });

    if (!error) {
      setForm({
        name: "",
        description: "",
        client: "",
        contact_id: "",
        status: "planning",
        start_date: "",
        due_date: "",
      });
      setOpen(false);
      fetchProjects();
    }
    setSaving(false);
  };

  const getStatusColor = (status: string) => {
    const s = projectStatuses.find((ps) => ps.name === status);
    return COLOR_MAP[s?.color || ""] || "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Track and manage your projects.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>New Project</DialogTitle>
                <DialogDescription>
                  Create a new project to track.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
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
                <div className="grid gap-2">
                  <Label htmlFor="client">Client Name</Label>
                  <Input
                    id="client"
                    value={form.client}
                    onChange={(e) =>
                      setForm({ ...form, client: e.target.value })
                    }
                    placeholder="Free text client name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Link to Contact{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={form.contact_id}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        contact_id: value === "none" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No contact linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No contact linked</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {contactName(c)}
                        </SelectItem>
                      ))}
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
                      {projectStatuses.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm({ ...form, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Project"}
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
              <CardTitle>All Projects</CardTitle>
              <CardDescription>
                Overview of all your projects and their status.
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : projects.filter((p) => {
                const q = search.toLowerCase();
                return !q || p.name.toLowerCase().includes(q) ||
                  p.client?.toLowerCase().includes(q) ||
                  (p.contacts ? contactName(p.contacts).toLowerCase().includes(q) : false);
              }).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No projects yet. Click &quot;New Project&quot; to create
                    one.
                  </TableCell>
                </TableRow>
              ) : (
                projects.filter((p) => {
                  const q = search.toLowerCase();
                  return !q || p.name.toLowerCase().includes(q) ||
                    p.client?.toLowerCase().includes(q) ||
                    (p.contacts ? contactName(p.contacts).toLowerCase().includes(q) : false);
                }).map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium">
                      {project.name}
                    </TableCell>
                    <TableCell>
                      {(project.contacts ? contactName(project.contacts) : null) || project.client || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize ${getStatusColor(project.status)}`}
                      >
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{project.start_date || "—"}</TableCell>
                    <TableCell>{project.due_date || "—"}</TableCell>
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

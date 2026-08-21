import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { roleRank } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";

interface Project {
  id: number;
  name: string;
  manager_id: number;
  description: string;
  deleted: boolean;
  created_at: string;
  members: ProjectMember[];
}

interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
}

interface User {
  id: number;
  name: string;
  surname: string;
  role: string;
}

// ─── Projects Page ────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isGlobalManager = roleRank(user?.role) > roleRank("manager");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // Members dialog
  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = user?.role === "manager" ? `/projects/?manager_id=${user.id}` : "/projects/";
      const res = await apiFetch(url);
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = async () => {
    setEditing(null);
    setName("");
    setDescription("");
    setManagerId(String(user?.id || ""));
    setFormOpen(true);
    if (users.length === 0) {
      const res = await apiFetch("/users/");
      if (res.ok) setUsers(await res.json());
    }
  };

  const openEdit = async (p: Project) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setManagerId(String(p.manager_id || ""));
    setFormOpen(true);
    if (users.length === 0) {
      const res = await apiFetch("/users/");
      if (res.ok) setUsers(await res.json());
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Loyiha nomi kiritilishi shart"); return; }
    if (!managerId) { toast.error("Menejer tanlanishi shart"); return; }
    setSaving(true);
    try {
      let res: Response;
      if (editing) {
        res = await apiFetch(`/projects/${editing.id}?manager_id=${managerId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), description: description.trim() }),
        });
      } else {
        res = await apiFetch(`/projects/?manager_id=${managerId}`, {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim() }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success(editing ? "Loyiha yangilandi" : "Loyiha yaratildi");
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await apiFetch(`/projects/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Loyiha o'chirildi");
      setDeleteTarget(null);
      load();
    } else {
      toast.error("O'chirishda xatolik");
    }
  };

  // Members management
  const openMembers = async (p: Project) => {
    setMembersProject(p);
    setAddUserId("");
    setMembersOpen(true);
    if (users.length === 0) {
      const res = await apiFetch("/users/");
      if (res.ok) setUsers(await res.json());
    }
    // Refresh members
    const res = await apiFetch(`/projects/${p.id}`);
    if (res.ok) {
      const updated: Project = await res.json();
      setMembersProject(updated);
      setProjects((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    }
  };

  const handleAddMember = async () => {
    if (!membersProject || !addUserId) return;
    setAddingMember(true);
    try {
      const res = await apiFetch(`/projects/${membersProject.id}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: Number(addUserId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success("A'zo qo'shildi");
      setAddUserId("");
      // Refresh
      const updated = await apiFetch(`/projects/${membersProject.id}`);
      if (updated.ok) {
        const data: Project = await updated.json();
        setMembersProject(data);
        setProjects((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!membersProject) return;
    setRemovingMemberId(userId);
    try {
      const res = await apiFetch(`/projects/${membersProject.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("O'chirishda xatolik");
        return;
      }
      toast.success("A'zo chiqarildi");
      const updated = await apiFetch(`/projects/${membersProject.id}`);
      if (updated.ok) {
        const data: Project = await updated.json();
        setMembersProject(data);
        setProjects((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      }
    } finally {
      setRemovingMemberId(null);
    }
  };

  const getUserName = (userId: number) => {
    const u = users.find((x) => x.id === userId);
    return u ? `${u.name} ${u.surname}` : `ID: ${userId}`;
  };

  const memberUserIds = new Set(membersProject?.members.map((m) => m.user_id) ?? []);
  const availableToAdd = users.filter((u) => !memberUserIds.has(u.id));

  return (
    <DashboardLayout title="Loyihalar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Loyihalar ro'yxati</h2>
        {isGlobalManager && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Yangi loyiha
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Loyihalar mavjud emas
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-12">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-40">Nomi</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-64">Tavsif</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">A'zolar</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">Yaratilgan</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {projects.map((project, i) => (
                <tr
                  key={project.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium truncate">{project.name}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate">
                    {project.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openMembers(project); }}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{project.members.length}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(project.created_at).toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {isGlobalManager && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(project)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(project)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Loyihani tahrirlash" : "Yangi loyiha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nomi *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Loyiha nomi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Menejer *</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Menejer tanlang" />
                </SelectTrigger>
                <SelectContent max-h-60 overflow-y-auto="true">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} {u.surname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tavsif</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qisqacha tavsif"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Loyihani o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> loyihasini o'chirishni tasdiqlaysizmi?
              Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{membersProject?.name} — A'zolar</DialogTitle>
          </DialogHeader>

          {/* Add member */}
          {(isGlobalManager || membersProject?.manager_id === user?.id) && (
            <div className="flex gap-2 mt-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Xodim tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} {u.surname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAddMember} disabled={!addUserId || addingMember}>
                {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* Members list */}
          <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
            {membersProject?.members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">A'zolar yo'q</p>
            ) : (
              membersProject?.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50"
                >
                  <span className="text-sm">{getUserName(m.user_id)}</span>
                  {(isGlobalManager || membersProject?.manager_id === user?.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(m.user_id)}
                      disabled={removingMemberId === m.user_id}
                    >
                      {removingMemberId === m.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

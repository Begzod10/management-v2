import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { roleRank } from "@/lib/permissions";

interface SectionMemberUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface SectionMember {
  id: number;
  section_id: number;
  user_id: number;
  user: SectionMemberUser;
}

interface Section {
  id: number;
  name: string;
  leader_id: number;
  deleted: boolean;
  created_at: string;
  members: SectionMember[];
}

interface User {
  id: number;
  name: string;
  surname: string;
  role: string;
}

export default function SectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isGlobalManager = roleRank(user?.role) > roleRank("manager");

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);

  // All users for leader select
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Members dialog
  const [membersSection, setMembersSection] = useState<Section | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = user?.role === "manager" ? `/sections/?leader_id=${user.id}` : "/sections/";
      const res = await apiFetch(url);
      if (res.ok) setSections(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setLeaderId(String(user?.id ?? ""));
    setFormOpen(true);
    if (allUsers.length === 0) {
      apiFetch("/users/")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAllUsers(Array.isArray(data) ? data : []));
    }
  };

  const openEdit = (s: Section) => {
    setEditing(s);
    setName(s.name);
    setLeaderId(String(s.leader_id));
    setFormOpen(true);
    if (allUsers.length === 0) {
      apiFetch("/users/")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAllUsers(Array.isArray(data) ? data : []));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Bo'lim nomi kiritilishi shart"); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), leader_id: Number(leaderId) || Number(user?.id) };
      const res = editing
        ? await apiFetch(`/sections/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/sections/", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success(editing ? "Bo'lim yangilandi" : "Bo'lim yaratildi");
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await apiFetch(`/sections/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Bo'lim o'chirildi");
      setDeleteTarget(null);
      load();
    } else {
      toast.error("O'chirishda xatolik");
    }
  };

  // Members
  const openMembers = async (s: Section) => {
    setMembersSection(s);
    setAddUserId("");
    setMembersOpen(true);
    if (users.length === 0) {
      const res = await apiFetch("/users/");
      if (res.ok) setUsers(await res.json());
    }
    const res = await apiFetch(`/sections/${s.id}`);
    if (res.ok) {
      const updated: Section = await res.json();
      setMembersSection(updated);
      setSections((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    }
  };

  const handleAddMember = async () => {
    if (!membersSection || !addUserId) return;
    setAddingMember(true);
    try {
      const res = await apiFetch(`/sections/${membersSection.id}/members`, {
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
      const updated = await apiFetch(`/sections/${membersSection.id}`);
      if (updated.ok) {
        const data: Section = await updated.json();
        setMembersSection(data);
        setSections((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!membersSection) return;
    setRemovingMemberId(userId);
    try {
      const res = await apiFetch(`/sections/${membersSection.id}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirishda xatolik"); return; }
      toast.success("A'zo chiqarildi");
      const updated = await apiFetch(`/sections/${membersSection.id}`);
      if (updated.ok) {
        const data: Section = await updated.json();
        setMembersSection(data);
        setSections((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      }
    } finally {
      setRemovingMemberId(null);
    }
  };

  const memberUserIds = new Set(membersSection?.members.map((m) => m.user_id) ?? []);
  const availableToAdd = users.filter((u) => !memberUserIds.has(u.id));

  return (
    <DashboardLayout title="Bo'limlar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Bo'limlar ro'yxati</h2>
        {isGlobalManager && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Yangi bo'lim
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Bo'limlar mavjud emas</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-12">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nomi</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">A'zolar</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Yaratilgan</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {sections.map((section, i) => (
                <tr
                  key={section.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/sections/${section.id}`)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{section.name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openMembers(section); }}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{section.members.length}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(section.created_at).toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {isGlobalManager && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(section)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(section)}
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

      {/* Create / Edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Bo'limni tahrirlash" : "Yangi bo'lim"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nomi *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bo'lim nomi" />
            </div>
            <div className="space-y-1.5">
              <Label>Rahbar</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Rahbar tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => {
                    const isSelf = u.id === Number(user?.id);
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        <span className={isSelf ? "font-semibold text-primary" : ""}>
                          {u.name} {u.surname}
                          {isSelf && " (siz)"}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Bo'limni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> bo'limini o'chirishni tasdiqlaysizmi?
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
            <DialogTitle>{membersSection?.name} — A'zolar</DialogTitle>
          </DialogHeader>

          {(isGlobalManager || membersSection?.leader_id === user?.id) && (
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

          <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
            {membersSection?.members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">A'zolar yo'q</p>
            ) : (
              membersSection?.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                        {m.user.name[0]}{m.user.surname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{m.user.name} {m.user.surname}</span>
                  </div>
                  {(isGlobalManager || membersSection?.leader_id === user?.id) && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(m.user_id)}
                      disabled={removingMemberId === m.user_id}
                    >
                      {removingMemberId === m.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
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

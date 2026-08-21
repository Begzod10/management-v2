import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { roleRank } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, ArrowLeft, Pencil, Trash2, Plus, X, Check,
  Users, Calendar, User, LayoutList,
} from "lucide-react";
import { toast } from "sonner";

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
  leader?: User;
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

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}

export default function SectionProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);

  const isGlobalManager = roleRank(authUser?.role) > roleRank("manager");
  const isSectionManager = section?.leader_id === authUser?.id;
  const canManageMembers = isGlobalManager || isSectionManager;

  // All users for leader select
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLeaderId, setEditLeaderId] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete section
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Members
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<SectionMember | null>(null);

  const loadSection = async () => {
    if (!id) return;
    const res = await apiFetch(`/sections/${id}`);
    if (!res.ok) {
      toast.error("Bo'lim topilmadi");
      navigate("/sections");
      return;
    }
    setSection(await res.json());
  };

  const loadUsers = async () => {
    if (usersLoaded) return;
    const res = await apiFetch("/users/");
    if (res.ok) { setUsers(await res.json()); setUsersLoaded(true); }
  };

  useEffect(() => {
    setLoading(true);
    loadSection().finally(() => setLoading(false));
  }, [id]);

  // Edit
  const startEdit = () => {
    if (!section) return;
    setEditName(section.name);
    setEditLeaderId(String(section.leader_id));
    setEditing(true);
    if (allUsers.length === 0) {
      apiFetch("/users/")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAllUsers(Array.isArray(data) ? data : []));
    }
  };

  const handleSave = async () => {
    if (!section || !editName.trim()) { toast.error("Nomi kiritilishi shart"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/sections/${section.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), leader_id: Number(editLeaderId) || section.leader_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success("Bo'lim yangilandi");
      setEditing(false);
      await loadSection();
    } finally {
      setSaving(false);
    }
  };

  // Delete section
  const handleDelete = async () => {
    if (!section) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/sections/${section.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Bo'lim o'chirildi");
      navigate("/sections");
    } finally {
      setDeleting(false);
    }
  };

  // Members
  const handleAddMember = async () => {
    if (!section || !addUserId) return;
    setAddingMember(true);
    try {
      const res = await apiFetch(`/sections/${section.id}/members`, {
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
      await loadSection();
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!section || !removeMemberTarget) return;
    setRemovingMemberId(removeMemberTarget.user_id);
    try {
      const res = await apiFetch(`/sections/${section.id}/members/${removeMemberTarget.user_id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirishda xatolik"); return; }
      toast.success("A'zo chiqarildi");
      setRemoveMemberTarget(null);
      await loadSection();
    } finally {
      setRemovingMemberId(null);
    }
  };

  const memberUserIds = new Set(section?.members.map((m) => m.user_id) ?? []);
  const availableToAdd = users.filter((u) => !memberUserIds.has(u.id) && roleRank(u.role) < roleRank("manager"));
  const availableStaff = availableToAdd.filter((u) => u.role !== "volunteer");
  const availableVolunteers = availableToAdd.filter((u) => u.role === "volunteer");

  const ROLES: Record<string, string> = {
    owner: "Owner", admin: "Admin", director: "Direktor", manager: "Menejer",
    hr: "HR", accountant: "Buxgalter", employee: "Xodim", user: "Foydalanuvchi",
  };

  return (
    <DashboardLayout
      title="Bo'lim profili"
      headerExtra={
        <Button variant="ghost" size="sm" onClick={() => navigate("/sections")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !section ? null : (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="pt-6 pb-0">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <LayoutList className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{section.name}</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />{section.members.length} a'zo
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(section.created_at).toLocaleDateString("uz-UZ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!editing && isGlobalManager && (
                        <Button variant="outline" size="sm" onClick={startEdit}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Tahrirlash
                        </Button>
                      )}
                      {isGlobalManager && (
                        <Button
                          variant="outline" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> O'chirish
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="info" className="mt-5">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="info"
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <LayoutList className="h-3.5 w-3.5 mr-1.5" /> Ma'lumot
                  </TabsTrigger>
                  <TabsTrigger
                    value="members"
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    onClick={loadUsers}
                  >
                    <Users className="h-3.5 w-3.5 mr-1.5" /> A'zolar
                  </TabsTrigger>
                </TabsList>

                {/* INFO TAB */}
                <TabsContent value="info" className="mt-0">
                  <div className="py-4">
                    {editing ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Nomi *</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Bo'lim nomi" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Rahbar</Label>
                          <Select value={editLeaderId} onValueChange={setEditLeaderId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Rahbar tanlang" />
                            </SelectTrigger>
                            <SelectContent>
                              {allUsers.map((u) => {
                                const isSelf = u.id === Number(authUser?.id);
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
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                            <X className="h-3.5 w-3.5 mr-1" /> Bekor
                          </Button>
                          <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                            Saqlash
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        <InfoRow icon={<LayoutList className="h-3.5 w-3.5" />} label="Nomi" value={section.name} />
                        <Separator />
                        <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Rahbar" value={section.leader ? (
                          <span 
                            className="text-primary hover:underline cursor-pointer"
                            onClick={() => navigate(`/staff/${section.leader!.id}`)}
                          >
                            {section.leader.name} {section.leader.surname}
                          </span>
                        ) : `ID: ${section.leader_id}`} />
                        <Separator />
                        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Yaratilgan sana" value={new Date(section.created_at).toLocaleString("uz-UZ")} />
                        <Separator />
                        <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="A'zolar soni" value={`${section.members.length} kishi`} />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* MEMBERS TAB */}
                <TabsContent value="members" className="mt-0">
                  <div className="py-4 space-y-4">
                    {/* Add member */}
                    {canManageMembers && (
                      <div className="flex gap-2">
                        <Select value={addUserId} onValueChange={setAddUserId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="A'zo qo'shish uchun tanlang..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableToAdd.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                {usersLoaded ? "Barcha xodimlar qo'shilgan" : "Yuklanmoqda..."}
                              </div>
                            ) : (
                              <>
                                {availableStaff.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Xodimlar</SelectLabel>
                                    {availableStaff.map((u) => (
                                      <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name} {u.surname}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {availableStaff.length > 0 && availableVolunteers.length > 0 && (
                                  <SelectSeparator />
                                )}
                                {availableVolunteers.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Volontyorlar</SelectLabel>
                                    {availableVolunteers.map((u) => (
                                      <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name} {u.surname}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleAddMember} disabled={!addUserId || addingMember} className="shrink-0">
                          {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Qo'shish</>}
                        </Button>
                      </div>
                    )}

                    {/* Members list — user object comes directly from API */}
                    {section.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Hali a'zolar yo'q</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {section.members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                  {m.user.name[0]}{m.user.surname[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p 
                                  className="text-sm font-medium hover:underline cursor-pointer"
                                  onClick={() => navigate(`/staff/${m.user_id}`)}
                                >
                                  {m.user.name} {m.user.surname}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ROLES[m.user.role] ?? m.user.role}
                                  {!m.user.is_active && <span className="ml-1 text-destructive">• Nofaol</span>}
                                </p>
                              </div>
                            </div>
                            {canManageMembers && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRemoveMemberTarget(m)}
                                disabled={removingMemberId === m.user_id}
                              >
                                {removingMemberId === m.user_id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete section */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bo'limni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{section?.name}</strong> bo'limini o'chirishni tasdiqlaysizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirm */}
      <AlertDialog open={!!removeMemberTarget} onOpenChange={(o) => !o && setRemoveMemberTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A'zoni chiqarish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeMemberTarget ? `${removeMemberTarget.user.name} ${removeMemberTarget.user.surname}` : ""}</strong> ni bo'limdan chiqarishni tasdiqlaysizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Chiqarish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

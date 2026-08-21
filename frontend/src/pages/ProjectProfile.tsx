import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { roleRank } from "@/lib/permissions";
import { ProjectTaskDialog } from "@/components/tasks/ProjectTaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { Task } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  FolderKanban,
  Users,
  Calendar,
  User,
  ClipboardList,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Project {
  id: number;
  name: string;
  manager_id: number;
  manager?: User;
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

// ── Helpers ────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function personName(val: any, fallbackId?: number): string {
  if (!val) return fallbackId ? String(fallbackId) : "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return `${val.name ?? ""} ${val.surname ?? ""}`.trim() || String(val.id ?? "");
  return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiTask(t: any): Task {
  return {
    id: String(t.id),
    title: t.title ?? "",
    description: t.description ?? "",
    status: t.status ?? "not_started",
    priority: t.priority ?? "medium",
    department: t.category ?? t.department ?? "admin",
    executor: personName(t.executor, t.executor?.id),
    executorId: t.executor?.id ?? t.executor_id,
    reviewer: personName(t.reviewer, t.reviewer_id),
    reviewerId: t.reviewer?.id ?? t.reviewer_id,
    creator: personName(t.creator, t.creator_id),
    creatorId: t.creator?.id ?? t.creator_id,
    deadline: t.deadline ?? "",
    createdAt: t.created_at ?? "",
    kpiWeight: t.kpi_weight ?? 0,
    recurring: t.is_recurring ?? false,
    recurringType: t.recurring_type,
    repeatEvery: t.repeat_every,
    tags: t.tags ?? [],
    subtasks: t.subtasks ?? [],
    comments: t.comments ?? [],
    attachments: t.attachments ?? [],
    proofs: t.proofs ?? [],
    project_id: t.project_id ?? undefined,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProjectProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const isGlobalManager = roleRank(authUser?.role) > roleRank("manager");
  const isProjectManager = project?.manager_id === authUser?.id;
  const canManageMembers = isGlobalManager || isProjectManager;

  // Edit project
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete project
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Members
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<ProjectMember | null>(null);

  // Tasks
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────

  const loadProject = async () => {
    if (!id) return;
    const res = await apiFetch(`/projects/${id}`);
    if (!res.ok) {
      toast.error("Loyiha topilmadi");
      navigate("/projects");
      return;
    }
    const data: Project = await res.json();
    setProject(data);
  };

  const loadUsers = async () => {
    const res = await apiFetch("/users/");
    if (res.ok) {
      setUsers(await res.json());
      setUsersLoaded(true);
    }
  };

  const loadTasks = async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await apiFetch(`/missions/?project_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.map(mapApiTask));
      }
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProject(), loadUsers()]).finally(() => setLoading(false));
  }, [id]);

  // ── Edit project ───────────────────────────────────────────────────────

  const startEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditName("");
    setEditDesc("");
  };

  const handleSave = async () => {
    if (!project || !editName.trim()) { toast.error("Nomi kiritilishi shart"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success("Loyiha yangilandi");
      setEditing(false);
      await loadProject();
    } finally {
      setSaving(false);
    }
  };

  // ── Delete project ─────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Loyiha o'chirildi");
      navigate("/projects");
    } finally {
      setDeleting(false);
    }
  };

  // ── Members ────────────────────────────────────────────────────────────

  const onMembersTabOpen = () => loadUsers();

  const handleAddMember = async () => {
    if (!project || !addUserId) return;
    setAddingMember(true);
    try {
      const res = await apiFetch(`/projects/${project.id}/members`, {
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
      await loadProject();
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!project || !removeMemberTarget) return;
    setRemovingMemberId(removeMemberTarget.user_id);
    try {
      const res = await apiFetch(`/projects/${project.id}/members/${removeMemberTarget.user_id}`, {
        method: "DELETE",
      });
      if (!res.ok) { toast.error("O'chirishda xatolik"); return; }
      toast.success("A'zo chiqarildi");
      setRemoveMemberTarget(null);
      await loadProject();
    } finally {
      setRemovingMemberId(null);
    }
  };

  const getUserName = (userId: number) => {
    const u = users.find((x) => x.id === userId);
    return u ? `${u.name} ${u.surname}` : `ID: ${userId}`;
  };

  const getUserInitials = (userId: number) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return "?";
    return `${u.name[0]}${u.surname[0]}`.toUpperCase();
  };

  const memberUserIds = new Set(project?.members.map((m) => m.user_id) ?? []);
  const availableToAdd = users.filter((u) => !memberUserIds.has(u.id) && roleRank(u.role) < roleRank("manager"));
  const availableStaff = availableToAdd.filter((u) => u.role !== "volunteer");
  const availableVolunteers = availableToAdd.filter((u) => u.role === "volunteer");

  const getUserRole = (userId: number) => users.find((x) => x.id === userId)?.role ?? "";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DashboardLayout
      title="Loyiha profili"
      headerExtra={
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !project ? null : (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="pt-6 pb-0">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{project.name}</h2>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {project.members.length} a'zo
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(project.created_at).toLocaleDateString("uz-UZ")}
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
                          variant="outline"
                          size="sm"
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
                    <FolderKanban className="h-3.5 w-3.5 mr-1.5" /> Ma'lumot
                  </TabsTrigger>
                  <TabsTrigger
                    value="members"
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    onClick={onMembersTabOpen}
                  >
                    <Users className="h-3.5 w-3.5 mr-1.5" /> A'zolar
                  </TabsTrigger>
                  <TabsTrigger
                    value="tasks"
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    onClick={loadTasks}
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Vazifalar
                  </TabsTrigger>
                </TabsList>

                {/* ── INFO TAB ── */}
                <TabsContent value="info" className="mt-0">
                  <div className="py-4">
                    {editing ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Nomi *</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Loyiha nomi"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Tavsif</Label>
                          <Textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Qisqacha tavsif"
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                            <X className="h-3.5 w-3.5 mr-1" /> Bekor
                          </Button>
                          <Button onClick={handleSave} disabled={saving}>
                            {saving
                              ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              : <Check className="h-3.5 w-3.5 mr-1" />
                            }
                            Saqlash
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        <InfoRow
                          icon={<FolderKanban className="h-3.5 w-3.5" />}
                          label="Nomi"
                          value={project.name}
                        />
                        <Separator />
                        <InfoRow
                          label="Tavsif"
                          value={project.description || "—"}
                        />
                        <Separator />
                        <InfoRow
                          icon={<User className="h-3.5 w-3.5" />}
                          label="Menejer"
                          value={project.manager ? (
                            <span 
                              className="text-primary hover:underline cursor-pointer"
                              onClick={() => navigate(`/users/${project.manager!.id}`)}
                            >
                              {project.manager.name} {project.manager.surname}
                            </span>
                          ) : `ID: ${project.manager_id}`}
                        />
                        <Separator />
                        <InfoRow
                          icon={<Calendar className="h-3.5 w-3.5" />}
                          label="Yaratilgan sana"
                          value={new Date(project.created_at).toLocaleString("uz-UZ")}
                        />
                        <Separator />
                        <InfoRow
                          icon={<Users className="h-3.5 w-3.5" />}
                          label="A'zolar soni"
                          value={`${project.members.length} kishi`}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── MEMBERS TAB ── */}
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
                        <Button
                          size="sm"
                          onClick={handleAddMember}
                          disabled={!addUserId || addingMember}
                          className="shrink-0"
                        >
                          {addingMember
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><Plus className="h-4 w-4 mr-1" /> Qo'shish</>
                          }
                        </Button>
                      </div>
                    )}

                    {/* Members list */}
                    {project.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Hali a'zolar yo'q
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {project.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                  {getUserInitials(m.user_id)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span 
                                  className="text-sm font-medium hover:underline cursor-pointer"
                                  onClick={() => navigate(`/staff/${m.user_id}`)}
                                >
                                  {getUserName(m.user_id)}
                                </span>
                                {getUserRole(m.user_id) === "volunteer" && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Volontyor</Badge>
                                )}
                              </div>
                            </div>
                            {canManageMembers && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRemoveMemberTarget(m)}
                                disabled={removingMemberId === m.user_id}
                              >
                                {removingMemberId === m.user_id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── TASKS TAB ── */}
                <TabsContent value="tasks" className="mt-0">
                  <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Loyiha uchun vazifalar
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setCreateTaskOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Vazifa yaratish
                      </Button>
                    </div>

                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Hali vazifalar yo'q
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedTask(task)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium">{task.title}</h4>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {task.department && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {task.department}
                                    </Badge>
                                  )}
                                  {task.deadline && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      <span>Muddat:</span>
                                      <span className="font-medium text-foreground">
                                        {new Date(task.deadline).toLocaleDateString("uz-UZ")}
                                      </span>
                                    </span>
                                  )}
                                  {task.executor && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>Ijrochi:</span>
                                      <span className="font-medium text-foreground">{task.executor}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
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

      {/* Delete project confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Loyihani o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{project?.name}</strong> loyihasini o'chirishni tasdiqlaysizmi?
              Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              O'chirish
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
              <strong>{removeMemberTarget ? getUserName(removeMemberTarget.user_id) : ""}</strong> ni
              loyihadan chiqarishni tasdiqlaysizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Chiqarish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Task Dialog */}
      {project && (
        <ProjectTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          onCreated={() => {
            setCreateTaskOpen(false);
            loadTasks();
          }}
          projectId={project.id}
          projectManagerId={project.manager_id}
          projectMembers={(() => {
            const members = project.members.map(m => {
              const user = users.find(u => u.id === m.user_id);
              return {
                id: m.user_id,
                name: user?.name || "",
                surname: user?.surname || "",
                role: user?.role,
              };
            }).filter(u => u.name);

            // Add project manager if not already in members
            const manager = users.find(u => u.id === project.manager_id);
            if (manager && !members.find(m => m.id === manager.id)) {
              members.unshift({
                id: manager.id,
                name: manager.name,
                surname: manager.surname,
                role: manager.role,
              });
            }

            return members;
          })()}
        />
      )}

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setSelectedTask(updated);
        }}
      />
    </DashboardLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { differenceInDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCircle,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Task } from "@/data/mockData";
import { apiFetch, apiFetchForm, attachmentUrl } from "@/lib/api";
import { mapApiTask } from "@/lib/taskMapper";
import { useAuth } from "@/contexts/AuthContext";
import { roleRank } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TaskStatus = Task["status"];

interface Subtask {
  id: number;
  mission_id?: number;
  creator_id?: number | null;
  title: string;
  description?: string | null;
  is_done: boolean;
  order?: number;
  status?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  finish_date?: string | null;
  executor_id?: number | null;
  creator?: { id?: number; name?: string; surname?: string } | null;
  executor_name?: string | null;
  executor?: { id?: number; name?: string; surname?: string } | null;
  comments_count?: number;
  attachments_count?: number;
  proofs_count?: number;
  is_overdue?: boolean;
  days_left?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface FileRow {
  id: number;
  file: string;
  note?: string;
  comment?: string;
  original_name?: string;
  uploaded_by?: string;
  created_at?: string;
  uploaded_at?: string;
}

interface CommentRow {
  id: number;
  user_id: number;
  text: string;
  attachment?: string | null;
  created_at?: string;
  user?: { name?: string; surname?: string } | string;
}

interface TaskUser {
  id: number;
  name: string;
  surname?: string;
  role?: string;
  sections?: Array<{ id: number }>;
  department?: string;
}

interface HistoryRow {
  id: number;
  mission_id?: number;
  changed_by_id?: number;
  executor_id?: number;
  reviewer_id?: number;
  gennis_executor_name?: string;
  gennis_reviewer_name?: string;
  turon_executor_name?: string;
  turon_reviewer_name?: string;
  note?: string;
  created_at?: string;
  changed_by?: TaskUser | null;
  executor?: TaskUser | null;
  reviewer?: TaskUser | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: "Boshlanmagan", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Jarayonda", className: "bg-info/10 text-info border-info/30" },
  done: { label: "Bajarildi", className: "bg-success/10 text-success border-success/30" },
  completed: { label: "Bajarildi", className: "bg-success/10 text-success border-success/30" },
  approved: { label: "Tasdiqlandi", className: "bg-success/10 text-success border-success/30" },
  blocked: { label: "Bloklangan", className: "bg-warning/10 text-warning border-warning/30" },
  declined: { label: "Rad etildi", className: "bg-destructive/10 text-destructive border-destructive/30" },
  recheck: { label: "Qayta tekshirish", className: "bg-info/10 text-info border-info/30" },
  overdue: { label: "Muddati o'tgan", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

const allStatuses = [
  { value: "not_started", label: "Boshlanmagan" },
  { value: "in_progress", label: "Jarayonda" },
  { value: "blocked", label: "Bloklangan" },
  { value: "completed", label: "Bajarildi" },
  { value: "approved", label: "Tasdiqlandi" },
  { value: "declined", label: "Rad etildi" },
  { value: "recheck", label: "Qayta tekshirish" },
] as const;

const STATUS_PERMISSIONS: Record<string, Record<string, string[]>> = {
  executor: {
    not_started: ["in_progress"],
    in_progress: ["blocked", "completed"],
    recheck: ["in_progress"],
    blocked: ["in_progress"],
  },
  reviewer: {
    completed: ["approved", "declined", "recheck"],
    declined: ["recheck"],
  },
};

const deptColors: Record<string, string> = {
  admin: "bg-muted text-muted-foreground",
  academic: "bg-info/10 text-info border-info/30",
  finance: "bg-warning/10 text-warning border-warning/30",
  hr: "bg-accent text-accent-foreground",
};

const getFileExt = (url: string) => (url.split("?")[0].split(".").pop() || "").toLowerCase();
const isImage = (url: string) => ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(getFileExt(url));
const isPdf = (url: string) => getFileExt(url) === "pdf";
const isOffice = (url: string) => ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(getFileExt(url));
const fileName = (row: FileRow) => row.original_name || row.file.split("/").pop()?.split("?")[0] || "file";
const fullName = (u?: Pick<TaskUser, "name" | "surname"> | null) => `${u?.name ?? ""} ${u?.surname ?? ""}`.trim();

function normalizeSubtask(raw: Subtask): Subtask {
  return {
    ...raw,
    executor_id: raw.executor_id ?? raw.executor?.id ?? null,
    executor_name: raw.executor_name ?? (raw.executor ? fullName(raw.executor) || null : null),
  };
}

function getFilePreviewUrl(file: File): string | null {
  return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
}

function FileIcon({ url }: { url: string }) {
  const ext = getFileExt(url);
  if (isImage(url)) return <FileImage className="h-4 w-4 shrink-0 text-blue-500" />;
  if (isPdf(url)) return <FileText className="h-4 w-4 shrink-0 text-red-500" />;
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />;
  if (["doc", "docx", "odt"].includes(ext)) return <FileText className="h-4 w-4 shrink-0 text-blue-600" />;
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function personLabel(value: CommentRow["user"], fallback: number) {
  if (!value) return `#${fallback}`;
  if (typeof value === "string") return value;
  return fullName(value) || `#${fallback}`;
}

function InfoCard({ icon: Icon, label, value, className }: { icon: typeof Clock; label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className={cn("mt-2 text-sm font-medium", className)}>{value || "-"}</div>
      </CardContent>
    </Card>
  );
}

export default function TaskProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const backTo = (location.state as { from?: string } | null)?.from ?? "/tasks";

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState(false);

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [attachments, setAttachments] = useState<FileRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [proofs, setProofs] = useState<FileRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [subtaskUsers, setSubtaskUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [projectMembers, setProjectMembers] = useState<Array<{ id: number; name: string; surname?: string; role?: string }>>([]);
  const [allUsers, setAllUsers] = useState<TaskUser[]>([]);

  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");
  const [newSubtaskStatus, setNewSubtaskStatus] = useState("not_started");
  const [newSubtaskDeadline, setNewSubtaskDeadline] = useState("");
  const [newSubtaskExecutorId, setNewSubtaskExecutorId] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskExecutorId, setEditingSubtaskExecutorId] = useState<number | null>(null);
  const [editSubtaskDescription, setEditSubtaskDescription] = useState("");
  const [editSubtaskStatus, setEditSubtaskStatus] = useState("not_started");
  const [editSubtaskDeadline, setEditSubtaskDeadline] = useState("");

  const [subtaskAttachments, setSubtaskAttachments] = useState<FileRow[]>([]);
  const [subtaskComments, setSubtaskComments] = useState<CommentRow[]>([]);
  const [subtaskProofs, setSubtaskProofs] = useState<FileRow[]>([]);
  const [subtaskAttachmentsLoading, setSubtaskAttachmentsLoading] = useState(false);
  const [subtaskCommentsLoading, setSubtaskCommentsLoading] = useState(false);
  const [subtaskProofsLoading, setSubtaskProofsLoading] = useState(false);
  const [pendingSubtaskAttFile, setPendingSubtaskAttFile] = useState<File | null>(null);
  const [pendingSubtaskAttNote, setPendingSubtaskAttNote] = useState("");
  const [uploadingSubtaskAtt, setUploadingSubtaskAtt] = useState(false);
  const [editSubtaskAttId, setEditSubtaskAttId] = useState<number | null>(null);
  const [editSubtaskAttNote, setEditSubtaskAttNote] = useState("");
  const [editSubtaskAttFile, setEditSubtaskAttFile] = useState<File | null>(null);
  const [savingSubtaskAtt, setSavingSubtaskAtt] = useState(false);
  const [pendingSubtaskProofFile, setPendingSubtaskProofFile] = useState<File | null>(null);
  const [pendingSubtaskProofComment, setPendingSubtaskProofComment] = useState("");
  const [uploadingSubtaskProof, setUploadingSubtaskProof] = useState(false);
  const [editSubtaskProofId, setEditSubtaskProofId] = useState<number | null>(null);
  const [editSubtaskProofComment, setEditSubtaskProofComment] = useState("");
  const [editSubtaskProofFile, setEditSubtaskProofFile] = useState<File | null>(null);
  const [savingSubtaskProof, setSavingSubtaskProof] = useState(false);
  const [showSubtaskCommentForm, setShowSubtaskCommentForm] = useState(false);
  const [subtaskCommentText, setSubtaskCommentText] = useState("");
  const [subtaskCommentFile, setSubtaskCommentFile] = useState<File | null>(null);
  const [sendingSubtaskComment, setSendingSubtaskComment] = useState(false);
  const [editSubtaskCommentId, setEditSubtaskCommentId] = useState<number | null>(null);
  const [editSubtaskCommentText, setEditSubtaskCommentText] = useState("");
  const [editSubtaskCommentFile, setEditSubtaskCommentFile] = useState<File | null>(null);
  const [savingSubtaskComment, setSavingSubtaskComment] = useState(false);

  const [pendingAttFile, setPendingAttFile] = useState<File | null>(null);
  const [pendingAttNote, setPendingAttNote] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editAttId, setEditAttId] = useState<number | null>(null);
  const [editAttNote, setEditAttNote] = useState("");
  const [editAttFile, setEditAttFile] = useState<File | null>(null);
  const [savingAtt, setSavingAtt] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<FileRow | null>(null);

  const [pendingProofFile, setPendingProofFile] = useState<File | null>(null);
  const [pendingProofComment, setPendingProofComment] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [editProofId, setEditProofId] = useState<number | null>(null);
  const [editProofComment, setEditProofComment] = useState("");
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [savingProof, setSavingProof] = useState(false);
  const [previewProof, setPreviewProof] = useState<{ rows: FileRow[]; index: number } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  function openProofPreview(rows: FileRow[], row: FileRow) {
    const index = rows.findIndex((r) => r.id === row.id);
    setPreviewProof({ rows, index: index >= 0 ? index : 0 });
  }

  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [editCommentId, setEditCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editCommentFile, setEditCommentFile] = useState<File | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [previewCommentFile, setPreviewCommentFile] = useState<string | null>(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [finishDate, setFinishDate] = useState<Date>();
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [newExecutorId, setNewExecutorId] = useState("");
  const [redirectPickerOpen, setRedirectPickerOpen] = useState(false);
  const [redirectSearch, setRedirectSearch] = useState("");
  const [redirectExpanded, setRedirectExpanded] = useState<Set<string>>(new Set());
  const [redirectProjectManagers, setRedirectProjectManagers] = useState<TaskUser[]>([]);
  const [redirectSectionLeaders, setRedirectSectionLeaders] = useState<TaskUser[]>([]);
  const [redirectUnassignedUsers, setRedirectUnassignedUsers] = useState<TaskUser[]>([]);

  const loadTask = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}`);
      if (!res.ok) {
        toast.error("Vazifa topilmadi");
        navigate("/tasks", { replace: true });
        return;
      }
      setTask(mapApiTask(await res.json()));
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  const loadSubtasks = async () => {
    if (!id) return;
    setSubtasksLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}/subtasks/`);
      const data = res.ok ? await res.json() : [];
      setSubtasks((Array.isArray(data) ? data : []).map(normalizeSubtask));
    } finally {
      setSubtasksLoading(false);
    }
  };

  const loadSubtaskRecords = async (subtaskId: number) => {
    if (!id) return;
    setSubtaskAttachmentsLoading(true);
    setSubtaskCommentsLoading(true);
    setSubtaskProofsLoading(true);
    try {
      const [attRes, commentRes, proofRes] = await Promise.all([
        apiFetch(`/missions/${id}/subtasks/${subtaskId}/attachments/`),
        apiFetch(`/missions/${id}/subtasks/${subtaskId}/comments/`),
        apiFetch(`/missions/${id}/subtasks/${subtaskId}/proofs/`),
      ]);
      const [attData, commentData, proofData] = await Promise.all([
        attRes.ok ? attRes.json() : [],
        commentRes.ok ? commentRes.json() : [],
        proofRes.ok ? proofRes.json() : [],
      ]);
      setSubtaskAttachments(Array.isArray(attData) ? attData : []);
      setSubtaskComments(Array.isArray(commentData) ? commentData : []);
      setSubtaskProofs(Array.isArray(proofData) ? proofData : []);
    } finally {
      setSubtaskAttachmentsLoading(false);
      setSubtaskCommentsLoading(false);
      setSubtaskProofsLoading(false);
    }
  };

  const refreshSubtask = async (subtaskId: number) => {
    if (!id) return;
    try {
      const res = await apiFetch(`/missions/${id}/subtasks/${subtaskId}`);
      if (!res.ok) return;
      const updated = normalizeSubtask(await res.json());
      setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedSubtask((current) => current?.id === updated.id ? updated : current);
    } catch {
      // Keep the current optimistic view; the list will refresh later.
    }
  };

  const loadAttachments = async () => {
    if (!id) return;
    setAttachmentsLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}/attachments/`);
      const data = res.ok ? await res.json() : [];
      setAttachments(Array.isArray(data) ? data : []);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}/comments/`);
      const data = res.ok ? await res.json() : [];
      setComments(Array.isArray(data) ? data : []);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadProofs = async () => {
    if (!id) return;
    setProofsLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}/proofs/`);
      const data = res.ok ? await res.json() : [];
      setProofs(Array.isArray(data) ? data : []);
    } finally {
      setProofsLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await apiFetch(`/missions/${id}/history`);
      const data = res.ok ? await res.json() : [];
      setHistory(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRelated = () => {
    loadSubtasks();
    loadAttachments();
    loadComments();
    loadProofs();
    loadHistory();
  };

  useEffect(() => {
    loadTask();
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!task || !user?.id) {
      setSubtaskUsers([]);
      return;
    }

    if (user.role === "manager") {
      apiFetch(`/users/${user.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (profile) => {
          if (!profile) return;
          const sectionIds: number[] = (profile.sections ?? []).map((s: { id?: number } | number) => typeof s === "number" ? s : s.id).filter(Number.isInteger);
          const projectIds: number[] = (profile.projects ?? []).map((p: { id?: number } | number) => typeof p === "number" ? p : p.id).filter(Number.isInteger);
          const memberMap = new Map<number, { id: number; name: string }>();

          memberMap.set(Number(user.id), { id: Number(user.id), name: `${user.name} ${user.surname ?? ""}`.trim() });
          await Promise.all([
            ...sectionIds.map((sid) => apiFetch(`/sections/${sid}/members`).then((r) => (r.ok ? r.json() : [])).then((data) => {
              (Array.isArray(data) ? data : []).forEach((m: { user?: TaskUser } & TaskUser) => {
                const u = m.user ?? m;
                if (u?.id) memberMap.set(u.id, { id: u.id, name: fullName(u) });
              });
            }).catch(() => undefined)),
            ...projectIds.map((pid) => apiFetch(`/projects/${pid}/members`).then((r) => (r.ok ? r.json() : [])).then((data) => {
              (Array.isArray(data) ? data : []).forEach((m: { user?: TaskUser } & TaskUser) => {
                const u = m.user ?? m;
                if (u?.id) memberMap.set(u.id, { id: u.id, name: fullName(u) });
              });
            }).catch(() => undefined)),
          ]);
          setSubtaskUsers(Array.from(memberMap.values()));
        })
        .catch(() => setSubtaskUsers([]));
      return;
    }

    apiFetch("/users/")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TaskUser[]) => {
        const self = { id: Number(user.id), name: `${user.name} ${user.surname ?? ""}`.trim() };
        const filtered = (Array.isArray(data) ? data : [])
          .filter((u) => roleRank(u.role) < roleRank(user.role))
          .map((u) => ({ id: u.id, name: fullName(u) }));
        const map = new Map([[self.id, self], ...filtered.map((u) => [u.id, u] as [number, { id: number; name: string }])]);
        setSubtaskUsers(Array.from(map.values()));
      })
      .catch(() => setSubtaskUsers([]));
  }, [task?.id, user?.id, user?.role]);

  useEffect(() => {
    if (!redirectOpen || !task) {
      setProjectMembers([]);
      setAllUsers([]);
      setRedirectProjectManagers([]);
      setRedirectSectionLeaders([]);
      setRedirectUnassignedUsers([]);
      return;
    }

    if (user?.role === "owner" || user?.role === "admin") {
      apiFetch("/users/project-managers")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setRedirectProjectManagers(Array.isArray(data) ? data : []))
        .catch(() => setRedirectProjectManagers([]));
      apiFetch("/users/section-leaders")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setRedirectSectionLeaders(Array.isArray(data) ? data : []))
        .catch(() => setRedirectSectionLeaders([]));
      apiFetch("/users/unassigned")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setRedirectUnassignedUsers(Array.isArray(data) ? data : []))
        .catch(() => setRedirectUnassignedUsers([]));
    }

    if (user?.role === "manager") {
      apiFetch(`/users/${user.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (profile) => {
          if (!profile) return;
          const sectionIds: number[] = (profile.sections ?? []).map((s: { id?: number } | number) => typeof s === "number" ? s : s.id).filter(Number.isInteger);
          const projectIds: number[] = (profile.projects ?? []).map((p: { id?: number } | number) => typeof p === "number" ? p : p.id).filter(Number.isInteger);
          const memberMap = new Map<number, { id: number; name: string; surname?: string; role?: string }>();
          await Promise.all([
            ...sectionIds.map((sid) => apiFetch(`/sections/${sid}/members`).then((r) => (r.ok ? r.json() : [])).then((data) => {
              (Array.isArray(data) ? data : []).forEach((m: { user?: TaskUser } & TaskUser) => {
                const u = m.user ?? m;
                if (u?.id) memberMap.set(u.id, { id: u.id, name: u.name ?? "", surname: u.surname ?? "", role: u.role ?? "" });
              });
            }).catch(() => undefined)),
            ...projectIds.map((pid) => apiFetch(`/projects/${pid}/members`).then((r) => (r.ok ? r.json() : [])).then((data) => {
              (Array.isArray(data) ? data : []).forEach((m: { user?: TaskUser } & TaskUser) => {
                const u = m.user ?? m;
                if (u?.id) memberMap.set(u.id, { id: u.id, name: u.name ?? "", surname: u.surname ?? "", role: u.role ?? "" });
              });
            }).catch(() => undefined)),
          ]);
          const members = Array.from(memberMap.values());
          setProjectMembers(members);
          setAllUsers(members);
        })
        .catch(() => {
          setProjectMembers([]);
          setAllUsers([]);
        });
      return;
    }

    if (task.project_id) {
      apiFetch(`/projects/${task.project_id}/members`)
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : data.items || data.users || [];
          setProjectMembers(list.map((m: { user?: TaskUser } & TaskUser) => m.user ?? m).filter(Boolean));
        })
        .catch(() => setProjectMembers([]));
    }

    apiFetch("/users/")
      .then((r) => r.json())
      .then((data) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => setAllUsers([]));
  }, [redirectOpen, user?.role, user?.id, task?.project_id, task?.id]);

  const status = task ? statusConfig[task.status] ?? { label: task.status, className: "bg-muted text-muted-foreground" } : null;
  const dept = task ? deptColors[task.department] ?? "bg-muted text-muted-foreground" : "";
  const isCreator = Boolean(user && task && String(task.creatorId) === String(user.id));
  const isReviewer = Boolean(user && task && String(task.reviewerId) === String(user.id));
  const isExecutor = Boolean(user && task && String(task.executorId) === String(user.id));
  const canManage = roleRank(user?.role) >= roleRank("manager");
  const canEditSubtasks = isCreator;
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const isOverdue = task?.status === "overdue";
  const overdueDays = task && isOverdue ? differenceInDays(new Date(), parseISO(task.deadline)) : 0;

  const canUpdateSubtaskProgress = (subtask?: Subtask | null) => (
    canEditSubtasks || Boolean(user?.id && subtask?.executor_id && String(subtask.executor_id) === String(user.id))
  );
  const canAddSubtaskRecords = (subtask?: Subtask | null) => Boolean(user?.id && subtask);

  const statusOptions = useMemo(() => {
    if (!task) return [];
    const allowed = new Set<string>([task.status]);
    if (isCreator || user?.role === "owner" || user?.role === "admin") {
      allStatuses.forEach((s) => allowed.add(s.value));
    } else {
      if (isExecutor && STATUS_PERMISSIONS.executor[task.status]) STATUS_PERMISSIONS.executor[task.status].forEach((s) => allowed.add(s));
      if (isReviewer && STATUS_PERMISSIONS.reviewer[task.status]) STATUS_PERMISSIONS.reviewer[task.status].forEach((s) => allowed.add(s));
    }
    return allStatuses.filter((s) => allowed.has(s.value));
  }, [isCreator, isExecutor, isReviewer, task, user?.role]);

  const redirectOptions = useMemo(() => {
    if (!task) return [];
    const parsedProjectMembers = projectMembers.map((m) => ({ id: m.id, name: fullName(m) || m.name, role: m.role ?? "" }));

    if (user?.role === "manager") {
      return parsedProjectMembers
        .filter((p) => String(p.id) !== String(task.executorId) && String(p.id) !== String(user?.id))
        .filter((p) => roleRank(p.role) < roleRank(user?.role))
        .map((p) => ({ id: p.id, name: p.name }));
    }

    if (user?.role === "owner" || user?.role === "admin") {
      // Owners can redirect to anyone eligible to be an executor — the same
      // pool (project managers, section leaders, unassigned staff) offered
      // when the task was created — not just the task's own participants.
      const pool = new Map<number, { id: number; name: string }>();
      [...redirectProjectManagers, ...redirectSectionLeaders, ...redirectUnassignedUsers].forEach((u) => {
        pool.set(u.id, { id: u.id, name: fullName(u) });
      });
      return Array.from(pool.values())
        .filter((p) => String(p.id) !== String(task.executorId))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const managerSectionIds = user?.sections?.map((s: { id: number }) => s.id) || [];
    const deptUsers = allUsers.filter((u) => {
      const uSecs = u.sections?.map((s) => s.id) || [];
      return uSecs.some((sectionId) => managerSectionIds.includes(sectionId)) || u.department === user?.department;
    });
    const combinedMap = new Map<number, { id: number; name: string; role?: string }>();
    parsedProjectMembers.forEach((m) => combinedMap.set(m.id, m));
    deptUsers.forEach((u) => combinedMap.set(u.id, { id: u.id, name: fullName(u), role: u.role }));
    return Array.from(combinedMap.values())
      .filter((p) => String(p.id) !== String(task.executorId) && roleRank(p.role) < roleRank(user?.role))
      .map((p) => ({ id: p.id, name: p.name }));
  }, [allUsers, projectMembers, redirectProjectManagers, redirectSectionLeaders, redirectUnassignedUsers, task, user]);

  const isOwnerRedirect = user?.role === "owner" || user?.role === "admin";
  const redirectPool = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    [...redirectProjectManagers, ...redirectSectionLeaders, ...redirectUnassignedUsers].forEach((u) => {
      map.set(u.id, { id: u.id, name: fullName(u) });
    });
    return map;
  }, [redirectProjectManagers, redirectSectionLeaders, redirectUnassignedUsers]);

  function openSubtaskProfile(subtask: Subtask) {
    setSelectedSubtask(subtask);
    setEditSubtaskDescription(subtask.description ?? "");
    setEditSubtaskStatus(subtask.status ?? (subtask.is_done ? "completed" : "not_started"));
    setEditSubtaskDeadline(subtask.deadline ?? "");
    setPendingSubtaskAttFile(null);
    setPendingSubtaskAttNote("");
    setPendingSubtaskProofFile(null);
    setPendingSubtaskProofComment("");
    setSubtaskCommentText("");
    setSubtaskCommentFile(null);
    setShowSubtaskCommentForm(false);
    setEditSubtaskAttId(null);
    setEditSubtaskProofId(null);
    setEditSubtaskCommentId(null);
    refreshSubtask(subtask.id);
    loadSubtaskRecords(subtask.id);
  }

  function closeSubtaskProfile() {
    setSelectedSubtask(null);
    setSubtaskAttachments([]);
    setSubtaskComments([]);
    setSubtaskProofs([]);
  }

  async function saveSubtaskProfile() {
    if (!task || !selectedSubtask || !canUpdateSubtaskProgress(selectedSubtask)) return;
    setSubtaskSaving(true);
    try {
      const body: Record<string, unknown> = { status: editSubtaskStatus };
      if (canEditSubtasks) {
        body.description = editSubtaskDescription;
        body.deadline = editSubtaskDeadline || null;
      }
      const res = await apiFetch(`/missions/${task.id}/subtasks/${selectedSubtask.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Kichik vazifani yangilab bo'lmadi");
        return;
      }
      const updated = normalizeSubtask(await res.json());
      setSelectedSubtask(updated);
      setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Kichik vazifa yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSubtaskSaving(false);
    }
  }

  const subtaskPath = (kind: "comments" | "attachments" | "proofs", rowId?: number) => {
    if (!task || !selectedSubtask) return "";
    return `/missions/${task.id}/subtasks/${selectedSubtask.id}/${kind}/${rowId ? rowId : ""}`;
  };

  async function updateStatus(newStatus: string) {
    if (!task) return;
    setStatusLoading(true);
    try {
      const res = await apiFetch(`/missions/${task.id}/status?status=${newStatus}`, { method: "PATCH" });
      if (!res.ok) {
        toast.error("Statusni o'zgartirib bo'lmadi");
        return;
      }
      setTask({ ...task, status: newStatus as TaskStatus });
      toast.success("Status o'zgartirildi");
      loadHistory();
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setStatusLoading(false);
    }
  }

  async function completeTask() {
    if (!task || !finishDate) return;
    setCompleteLoading(true);
    try {
      const res = await apiFetch(`/missions/${task.id}/complete?finish_date=${format(finishDate, "yyyy-MM-dd")}`, { method: "POST" });
      if (!res.ok) {
        toast.error("Vazifani yakunlab bo'lmadi");
        return;
      }
      setCompleteOpen(false);
      setFinishDate(undefined);
      setTask({ ...task, status: "completed" });
      toast.success("Vazifa yakunlandi");
      loadHistory();
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setCompleteLoading(false);
    }
  }

  async function redirectTask() {
    if (!task || !user || !newExecutorId) return;
    setRedirectLoading(true);
    try {
      const res = await apiFetch(`/missions/${task.id}/redirect?new_executor_id=${newExecutorId}&redirected_by_id=${user.id}`, { method: "PATCH" });
      if (!res.ok) {
        toast.error("Yo'naltirib bo'lmadi");
        return;
      }
      setRedirectOpen(false);
      setNewExecutorId("");
      toast.success("Vazifa yo'naltirildi");
      loadTask();
      loadHistory();
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setRedirectLoading(false);
    }
  }

  async function addSubtask() {
    if (!task || !newSubtaskTitle.trim() || !canEditSubtasks) return;
    setAddingSubtask(true);
    try {
      const body: Record<string, unknown> = {
        title: newSubtaskTitle.trim(),
        description: newSubtaskDescription.trim() || null,
        order: subtasks.length + 1,
        status: newSubtaskStatus,
        creator_id: user?.id ?? 1,
        deadline: newSubtaskDeadline || null,
      };
      if (newSubtaskExecutorId) body.executor_id = Number(newSubtaskExecutorId);
      const res = await apiFetch(`/missions/${task.id}/subtasks/?creator_id=${user?.id ?? 1}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Kichik vazifa qo'shib bo'lmadi");
        return;
      }
      const created = normalizeSubtask(await res.json());
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
      setNewSubtaskDescription("");
      setNewSubtaskStatus("not_started");
      setNewSubtaskDeadline("");
      setNewSubtaskExecutorId("");
      setShowAddSubtask(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setAddingSubtask(false);
    }
  }

  async function toggleSubtask(subtask: Subtask) {
    if (!task || !canUpdateSubtaskProgress(subtask)) return;
    const updated = { ...subtask, is_done: !subtask.is_done };
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: subtask.title, is_done: updated.is_done, order: subtask.order ?? 0 }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? subtask : s)));
      toast.error("O'zgartirib bo'lmadi");
    }
  }

  async function editSubtaskTitle(subtask: Subtask, newTitle: string) {
    const title = newTitle.trim();
    setEditingSubtaskId(null);
    if (!task || !title || title === subtask.title || !canEditSubtasks) return;
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, title } : s)));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, is_done: subtask.is_done, order: subtask.order ?? 0 }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? subtask : s)));
      toast.error("O'zgartirib bo'lmadi");
    }
  }

  async function editSubtaskExecutor(subtask: Subtask, executorId: string) {
    if (!task || !canEditSubtasks) return;
    setEditingSubtaskExecutorId(null);
    const nextId = executorId && executorId !== "__none__" ? Number(executorId) : null;
    const optimistic = { ...subtask, executor_id: nextId, executor_name: nextId ? subtaskUsers.find((u) => u.id === nextId)?.name ?? null : null };
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? optimistic : s)));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: subtask.title, is_done: subtask.is_done, order: subtask.order ?? 0, executor_id: nextId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? subtask : s)));
      toast.error("Ijrochi o'zgartirib bo'lmadi");
    }
  }

  async function deleteSubtask(subtask: Subtask) {
    if (!task || !canEditSubtasks) return;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSubtasks((prev) => [...prev, subtask].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      toast.error("O'chirib bo'lmadi");
    }
  }

  function handlePaste(e: React.ClipboardEvent, target: "attachments" | "proofs" | "comments" | "subtask-attachments" | "subtask-proofs" | "subtask-comments") {
    if (target.startsWith("subtask-") && !canAddSubtaskRecords(selectedSubtask)) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();
      if (target === "attachments") {
        setPendingAttFile(file);
        setPendingAttNote("");
      } else if (target === "proofs") {
        setPendingProofFile(file);
        setPendingProofComment("");
      } else if (target === "subtask-attachments") {
        setPendingSubtaskAttFile(file);
        setPendingSubtaskAttNote("");
      } else if (target === "subtask-proofs") {
        setPendingSubtaskProofFile(file);
        setPendingSubtaskProofComment("");
      } else if (target === "subtask-comments") {
        setSubtaskCommentFile(file);
        setShowSubtaskCommentForm(true);
      } else {
        setCommentFile(file);
        setShowCommentForm(true);
      }
      toast.success("Rasm qo'shildi");
      return;
    }
  }

  async function submitAttachment() {
    if (!task || !pendingAttFile) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingAttFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingAttNote.trim()) fd.append("note", pendingAttNote.trim());
      const res = await apiFetchForm(`/missions/${task.id}/attachments/`, fd);
      if (!res.ok) {
        toast.error("Fayl yuklab bo'lmadi");
        return;
      }
      const created = await res.json();
      setAttachments((prev) => [...prev, created]);
      setPendingAttFile(null);
      setPendingAttNote("");
      toast.success("Fayl yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingFile(false);
    }
  }

  async function saveAttachment(row: FileRow) {
    if (!task) return;
    setSavingAtt(true);
    try {
      const fd = new FormData();
      if (editAttFile) fd.append("file", editAttFile);
      fd.append("note", editAttNote);
      const res = await apiFetchForm(`/missions/${task.id}/attachments/${row.id}`, fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      const updated = await res.json();
      setAttachments((prev) => prev.map((a) => (a.id === row.id ? updated : a)));
      setEditAttId(null);
      setEditAttFile(null);
      loadAttachments();
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingAtt(false);
    }
  }

  async function submitProof() {
    if (!task || !pendingProofFile) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingProofFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingProofComment.trim()) fd.append("comment", pendingProofComment.trim());
      const res = await apiFetchForm(`/missions/${task.id}/proofs/`, fd);
      if (!res.ok) {
        toast.error("Dalil yuklab bo'lmadi");
        return;
      }
      const created = await res.json();
      setProofs((prev) => [...prev, created]);
      setPendingProofFile(null);
      setPendingProofComment("");
      toast.success("Dalil yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingProof(false);
    }
  }

  async function saveProof(row: FileRow) {
    if (!task) return;
    setSavingProof(true);
    try {
      const fd = new FormData();
      if (editProofFile) fd.append("file", editProofFile);
      fd.append("comment", editProofComment);
      const res = await apiFetchForm(`/missions/${task.id}/proofs/${row.id}`, fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      setEditProofId(null);
      setEditProofFile(null);
      loadProofs();
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingProof(false);
    }
  }

  async function deleteFile(kind: "attachments" | "proofs", row: FileRow) {
    if (!task) return;
    const setter = kind === "attachments" ? setAttachments : setProofs;
    setter((prev) => prev.filter((item) => item.id !== row.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/${kind}/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setter((prev) => [...prev, row]);
      toast.error("O'chirib bo'lmadi");
    }
  }

  async function sendComment() {
    if (!task || !user || (!commentText.trim() && !commentFile)) return;
    setSendingComment(true);
    try {
      const fd = new FormData();
      fd.append("user_id", String(user.id));
      fd.append("text", commentText.trim());
      if (commentFile) fd.append("attachment", commentFile);
      const res = await apiFetchForm(`/missions/${task.id}/comments/`, fd);
      if (!res.ok) {
        toast.error("Izoh yuborib bo'lmadi");
        return;
      }
      const created = await res.json();
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setCommentFile(null);
      setShowCommentForm(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSendingComment(false);
    }
  }

  async function saveComment(comment: CommentRow) {
    if (!task || !editCommentText.trim()) return;
    setSavingComment(true);
    try {
      const fd = new FormData();
      fd.append("text", editCommentText.trim());
      if (editCommentFile) fd.append("attachment", editCommentFile);
      const res = await apiFetchForm(`/missions/${task.id}/comments/${comment.id}`, fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      setEditCommentId(null);
      setEditCommentFile(null);
      loadComments();
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingComment(false);
    }
  }

  async function deleteComment(comment: CommentRow) {
    if (!task) return;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/comments/${comment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setComments((prev) => [...prev, comment]);
      toast.error("O'chirib bo'lmadi");
    }
  }

  async function submitSubtaskAttachment() {
    if (!selectedSubtask || !pendingSubtaskAttFile || !canAddSubtaskRecords(selectedSubtask)) return;
    setUploadingSubtaskAtt(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingSubtaskAttFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingSubtaskAttNote.trim()) fd.append("note", pendingSubtaskAttNote.trim());
      const res = await apiFetchForm(subtaskPath("attachments"), fd);
      if (!res.ok) {
        toast.error("Fayl yuklab bo'lmadi");
        return;
      }
      const created = await res.json();
      setSubtaskAttachments((prev) => [...prev, created]);
      refreshSubtask(selectedSubtask.id);
      setPendingSubtaskAttFile(null);
      setPendingSubtaskAttNote("");
      toast.success("Fayl yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingSubtaskAtt(false);
    }
  }

  async function saveSubtaskAttachment(row: FileRow) {
    if (!selectedSubtask || !canEditSubtasks) return;
    setSavingSubtaskAtt(true);
    try {
      const fd = new FormData();
      if (editSubtaskAttFile) fd.append("file", editSubtaskAttFile);
      fd.append("note", editSubtaskAttNote);
      const res = await apiFetchForm(subtaskPath("attachments", row.id), fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      const updated = await res.json();
      setSubtaskAttachments((prev) => prev.map((a) => (a.id === row.id ? updated : a)));
      setEditSubtaskAttId(null);
      setEditSubtaskAttFile(null);
      refreshSubtask(selectedSubtask.id);
      loadSubtaskRecords(selectedSubtask.id);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingSubtaskAtt(false);
    }
  }

  async function submitSubtaskProof() {
    if (!selectedSubtask || !pendingSubtaskProofFile || !canAddSubtaskRecords(selectedSubtask)) return;
    setUploadingSubtaskProof(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingSubtaskProofFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingSubtaskProofComment.trim()) fd.append("comment", pendingSubtaskProofComment.trim());
      const res = await apiFetchForm(subtaskPath("proofs"), fd);
      if (!res.ok) {
        toast.error("Dalil yuklab bo'lmadi");
        return;
      }
      const created = await res.json();
      setSubtaskProofs((prev) => [...prev, created]);
      refreshSubtask(selectedSubtask.id);
      setPendingSubtaskProofFile(null);
      setPendingSubtaskProofComment("");
      toast.success("Dalil yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingSubtaskProof(false);
    }
  }

  async function saveSubtaskProof(row: FileRow) {
    if (!selectedSubtask || !canEditSubtasks) return;
    setSavingSubtaskProof(true);
    try {
      const fd = new FormData();
      if (editSubtaskProofFile) fd.append("file", editSubtaskProofFile);
      fd.append("comment", editSubtaskProofComment);
      const res = await apiFetchForm(subtaskPath("proofs", row.id), fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      setEditSubtaskProofId(null);
      setEditSubtaskProofFile(null);
      refreshSubtask(selectedSubtask.id);
      loadSubtaskRecords(selectedSubtask.id);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingSubtaskProof(false);
    }
  }

  async function deleteSubtaskFile(kind: "attachments" | "proofs", row: FileRow) {
    if (!selectedSubtask || !canEditSubtasks) return;
    const setter = kind === "attachments" ? setSubtaskAttachments : setSubtaskProofs;
    setter((prev) => prev.filter((item) => item.id !== row.id));
    try {
      const res = await apiFetch(subtaskPath(kind, row.id), { method: "DELETE" });
      if (!res.ok) throw new Error();
      refreshSubtask(selectedSubtask.id);
    } catch {
      setter((prev) => [...prev, row]);
      toast.error("O'chirib bo'lmadi");
    }
  }

  async function sendSubtaskComment() {
    if (!selectedSubtask || !user || !canAddSubtaskRecords(selectedSubtask) || (!subtaskCommentText.trim() && !subtaskCommentFile)) return;
    setSendingSubtaskComment(true);
    try {
      const fd = new FormData();
      fd.append("user_id", String(user.id));
      fd.append("text", subtaskCommentText.trim());
      if (subtaskCommentFile) fd.append("attachment", subtaskCommentFile);
      const res = await apiFetchForm(subtaskPath("comments"), fd);
      if (!res.ok) {
        toast.error("Izoh yuborib bo'lmadi");
        return;
      }
      const created = await res.json();
      setSubtaskComments((prev) => [...prev, created]);
      refreshSubtask(selectedSubtask.id);
      setSubtaskCommentText("");
      setSubtaskCommentFile(null);
      setShowSubtaskCommentForm(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSendingSubtaskComment(false);
    }
  }

  async function saveSubtaskComment(comment: CommentRow) {
    if (!selectedSubtask || !editSubtaskCommentText.trim() || !canEditSubtasks) return;
    setSavingSubtaskComment(true);
    try {
      const fd = new FormData();
      fd.append("text", editSubtaskCommentText.trim());
      if (editSubtaskCommentFile) fd.append("attachment", editSubtaskCommentFile);
      const res = await apiFetchForm(subtaskPath("comments", comment.id), fd, "PATCH");
      if (!res.ok) {
        toast.error("O'zgartirib bo'lmadi");
        return;
      }
      setEditSubtaskCommentId(null);
      setEditSubtaskCommentFile(null);
      refreshSubtask(selectedSubtask.id);
      loadSubtaskRecords(selectedSubtask.id);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingSubtaskComment(false);
    }
  }

  async function deleteSubtaskComment(comment: CommentRow) {
    if (!selectedSubtask || !canEditSubtasks) return;
    setSubtaskComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      const res = await apiFetch(subtaskPath("comments", comment.id), { method: "DELETE" });
      if (!res.ok) throw new Error();
      refreshSubtask(selectedSubtask.id);
    } catch {
      setSubtaskComments((prev) => [...prev, comment]);
      toast.error("O'chirib bo'lmadi");
    }
  }

  function openFile(row: FileRow) {
    const url = attachmentUrl(row.file);
    if (isImage(row.file)) {
      setPreviewAtt(row);
      return;
    }
    if (isPdf(row.file)) {
      window.open(url, "_blank");
      return;
    }
    if (isOffice(row.file)) {
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}`, "_blank");
      return;
    }
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <DashboardLayout title="Vazifa profili">
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task || !status) return null;

  return (
    <DashboardLayout title="Vazifa profili">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 overflow-hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(backTo)} className="w-fit shrink-0 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Vazifalarga qaytish
        </Button>

        <div className="flex shrink-0 flex-col gap-3 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={dept}>{task.department.toUpperCase()}</Badge>
                <Badge variant="outline" className={status.className}>{status.label}</Badge>
                {task.recurring && <Badge variant="outline"><Repeat className="mr-1 h-3 w-3" />Takroriy</Badge>}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
              <p className="text-sm text-muted-foreground">#{task.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={task.status} onValueChange={updateStatus} disabled={statusLoading || statusOptions.length <= 1}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              {isCreator && <Button variant="outline" size="sm" onClick={() => setCompleteOpen(true)}><CheckCircle2 className="mr-1 h-4 w-4" />Yakunlash</Button>}
              {canManage && <Button variant="outline" size="sm" onClick={() => setRedirectOpen(true)}><ArrowRightLeft className="mr-1 h-4 w-4" />Yo'naltirish</Button>}
            </div>
          </div>
          {isOverdue && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {overdueDays} kun kechikdi
            </div>
          )}
        </div>

        <Tabs defaultValue="main" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <TabsList className="flex h-auto shrink-0 flex-wrap justify-start">
            <TabsTrigger value="main">Asosiy</TabsTrigger>
            <TabsTrigger value="subtasks">Kichik vazifalar ({doneCount}/{subtasks.length})</TabsTrigger>
            <TabsTrigger value="attachments">Ilovalar ({attachments.length})</TabsTrigger>
            <TabsTrigger value="comments">Izohlar ({comments.length})</TabsTrigger>
            <TabsTrigger value="proofs">Dalillar ({proofs.length})</TabsTrigger>
            <TabsTrigger value="history">Tarix ({history.length})</TabsTrigger>
          </TabsList>

          <ScrollTab value="main">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard icon={UserCircle} label="Yaratuvchi" value={task.creator} />
              <InfoCard icon={CheckCircle2} label="Ijrochi" value={task.executor} />
              <InfoCard icon={ShieldCheck} label="Tekshiruvchi" value={task.reviewer} />
              <InfoCard icon={CalendarIcon} label="Muddat" value={task.deadline} className={isOverdue ? "text-destructive" : ""} />
              <InfoCard icon={Clock} label="Yaratildi" value={task.createdAt ? format(parseISO(task.createdAt), "MMM d, HH:mm") : ""} />
              <InfoCard icon={task.kpiWeight >= 0 ? TrendingUp : TrendingDown} label="KPI og'irligi" value={`${task.kpiWeight > 0 ? "+" : ""}${task.kpiWeight}`} className={task.kpiWeight >= 0 ? "text-success" : "text-destructive"} />
              <InfoCard icon={Repeat} label="Takroriy" value={task.recurring ? `${task.recurringType ?? ""} / ${task.repeatEvery ?? ""}` : "Yo'q"} />
            </div>
            <Card><CardHeader><CardTitle>Tavsif</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description || "Tavsif kiritilmagan"}</p></CardContent></Card>
          </ScrollTab>

          <FixedTab value="subtasks">
            <Card className="flex h-full min-h-0 flex-col">
              <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Kichik vazifalar</CardTitle></CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                {showAddSubtask && canEditSubtasks ? (
                  <div className="shrink-0 space-y-2 rounded-md border p-3">
                    <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder="Kichik vazifa nomi" disabled={addingSubtask} />
                    <Textarea value={newSubtaskDescription} onChange={(e) => setNewSubtaskDescription(e.target.value)} placeholder="Tavsif (ixtiyoriy)" disabled={addingSubtask} />
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select value={newSubtaskStatus} onValueChange={setNewSubtaskStatus} disabled={addingSubtask}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>{allStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="date" value={newSubtaskDeadline} onChange={(e) => setNewSubtaskDeadline(e.target.value)} disabled={addingSubtask} />
                    </div>
                    {subtaskUsers.length > 0 && canEditSubtasks && (
                      <div>
                        <Select value={newSubtaskExecutorId} onValueChange={setNewSubtaskExecutorId} disabled={addingSubtask}>
                          <SelectTrigger><SelectValue placeholder="Ijrochi (ixtiyoriy)" /></SelectTrigger>
                          <SelectContent>{subtaskUsers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={addSubtask} disabled={!newSubtaskTitle.trim() || addingSubtask}>{addingSubtask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qo'sh"}</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddSubtask(false);
                          setNewSubtaskTitle("");
                          setNewSubtaskDescription("");
                          setNewSubtaskStatus("not_started");
                          setNewSubtaskDeadline("");
                          setNewSubtaskExecutorId("");
                        }}
                      >
                        Bekor
                      </Button>
                    </div>
                  </div>
                ) : canEditSubtasks ? (
                  <Button variant="ghost" onClick={() => setShowAddSubtask(true)} className="w-fit shrink-0"><Plus className="mr-1 h-4 w-4" />Kichik vazifa qo'shish</Button>
                ) : null}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                  {subtasksLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : subtasks.length ? subtasks.map((s) => (
                    <div key={s.id} className="group flex items-start gap-3 rounded-md border p-3">
                      <Checkbox className="mt-1" checked={s.is_done} onCheckedChange={() => toggleSubtask(s)} disabled={!canUpdateSubtaskProgress(s)} />
                      <div className="min-w-0 flex-1 space-y-1">
                        {editingSubtaskId === s.id && canEditSubtasks ? (
                          <Input
                            autoFocus
                            className="h-8"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => editSubtaskTitle(s, editingSubtaskTitle)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") editSubtaskTitle(s, editingSubtaskTitle);
                              if (e.key === "Escape") setEditingSubtaskId(null);
                            }}
                          />
                        ) : (
                          <div
                            className={cn("cursor-pointer text-sm", s.is_done && "line-through text-muted-foreground")}
                            onDoubleClick={() => { if (canEditSubtasks) { setEditingSubtaskId(s.id); setEditingSubtaskTitle(s.title); } }}
                          >
                            {s.title}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={statusConfig[s.status ?? (s.is_done ? "completed" : "not_started")]?.className ?? "bg-muted text-muted-foreground"}>
                            {statusConfig[s.status ?? (s.is_done ? "completed" : "not_started")]?.label ?? s.status ?? "Boshlanmagan"}
                          </Badge>
                          {s.is_overdue && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Muddati o'tgan</Badge>}
                          {s.deadline && (
                            <span className={cn("text-xs", s.is_overdue ? "text-destructive" : "text-muted-foreground")}>
                              Muddat: {s.deadline}
                              {typeof s.days_left === "number" && ` · ${s.days_left >= 0 ? `${s.days_left} kun qoldi` : `${Math.abs(s.days_left)} kun kechikdi`}`}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="h-3 w-3" />{s.comments_count ?? 0}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" />{s.attachments_count ?? 0}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Upload className="h-3 w-3" />{s.proofs_count ?? 0}</span>
                        </div>
                        {editingSubtaskExecutorId === s.id && canEditSubtasks ? (
                          <Select defaultOpen value={s.executor_id ? String(s.executor_id) : ""} onValueChange={(v) => editSubtaskExecutor(s, v)} onOpenChange={(open) => { if (!open) setEditingSubtaskExecutorId(null); }}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Ijrochi tanlang" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Ijrochisiz</SelectItem>
                              {subtaskUsers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {s.executor_name || "Ijrochi belgilanmagan"}
                            {subtaskUsers.length > 0 && canEditSubtasks && <button onClick={() => setEditingSubtaskExecutorId(s.id)}><Pencil className="h-3.5 w-3.5" /></button>}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openSubtaskProfile(s)}><Eye className="h-4 w-4" /></Button>
                      {canEditSubtasks && <Button variant="ghost" size="icon" onClick={() => deleteSubtask(s)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Kichik vazifalar yo'q</p>}
                </div>
              </CardContent>
            </Card>
          </FixedTab>

          <FixedTab value="attachments">
            <FileTab
              title="Ilovalar"
              rows={attachments}
              kind="attachments"
              loading={attachmentsLoading}
              pendingFile={pendingAttFile}
              pendingText={pendingAttNote}
              setPendingFile={setPendingAttFile}
              setPendingText={setPendingAttNote}
              uploading={uploadingFile}
              editId={editAttId}
              editText={editAttNote}
              setEditId={setEditAttId}
              setEditText={setEditAttNote}
              setEditFile={setEditAttFile}
              saving={savingAtt}
              onPaste={(e) => handlePaste(e, "attachments")}
              onPendingPreview={setFullscreenImage}
              onSubmit={submitAttachment}
              onSave={saveAttachment}
              onOpen={openFile}
              onPreview={(row) => setPreviewAtt(row)}
              onDelete={deleteFile}
            />
          </FixedTab>

          <FixedTab value="comments">
            <Card onPaste={(e) => handlePaste(e, "comments")} tabIndex={0} className="flex h-full min-h-0 flex-col outline-none">
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Izohlar</CardTitle></CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                {showCommentForm ? (
                  <div className="shrink-0 space-y-2 rounded-md border p-3">
                    <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Izoh yozing..." onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) sendComment(); }} disabled={sendingComment} />
                    {commentFile && <PendingFilePreview file={commentFile} onClear={() => setCommentFile(null)} onPreview={setFullscreenImage} />}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-4 w-4" />
                        <input type="file" className="hidden" onChange={(e) => setCommentFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
                      </label>
                      <span className="min-w-32 flex-1 text-xs text-muted-foreground">Ctrl+Enter — yuborish</span>
                      <Button variant="outline" size="sm" onClick={() => { setShowCommentForm(false); setCommentText(""); setCommentFile(null); }} disabled={sendingComment}>Bekor</Button>
                      <Button size="sm" onClick={sendComment} disabled={(!commentText.trim() && !commentFile) || sendingComment}>{sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yuborish"}</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setShowCommentForm(true)} className="w-fit shrink-0"><Plus className="mr-1 h-4 w-4" />Izoh qo'shish</Button>
                )}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
                  {commentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : comments.length ? comments.map((c) => (
                    <div key={c.id} className="group flex gap-3 rounded-md border p-3">
                      <Avatar className="h-8 w-8"><AvatarFallback>{personLabel(c.user, c.user_id).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{personLabel(c.user, c.user_id)}</span>
                          {c.created_at && <span className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, HH:mm")}</span>}
                          {String(user?.id) === String(c.user_id) && editCommentId !== c.id && (
                            <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button variant="ghost" size="icon" onClick={() => { setEditCommentId(c.id); setEditCommentText(c.text); setEditCommentFile(null); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteComment(c)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </div>
                        {editCommentId === c.id ? (
                          <div className="mt-2 space-y-2">
                            <Textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} disabled={savingComment} />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                                <Paperclip className="h-4 w-4" />
                                <input type="file" className="hidden" onChange={(e) => setEditCommentFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
                              </label>
                              {editCommentFile && <span className="flex min-w-32 flex-1 items-center gap-1 truncate text-xs text-muted-foreground">{editCommentFile.name}<button onClick={() => setEditCommentFile(null)}><X className="h-3 w-3" /></button></span>}
                              <Button variant="outline" size="sm" onClick={() => setEditCommentId(null)} disabled={savingComment}>Bekor</Button>
                              <Button size="sm" onClick={() => saveComment(c)} disabled={!editCommentText.trim() || savingComment}>{savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Saqlash"}</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.text}</p>
                            {c.attachment && (
                              isImage(c.attachment) ? (
                                <img src={attachmentUrl(c.attachment)} alt="attachment" className="mt-2 max-h-40 cursor-pointer rounded border object-cover" onClick={() => setPreviewCommentFile(attachmentUrl(c.attachment!))} />
                              ) : (
                                <a className="mt-2 inline-flex items-center gap-2 rounded border px-2 py-1 text-sm text-primary hover:underline" href={attachmentUrl(c.attachment)} target="_blank" rel="noreferrer"><FileIcon url={c.attachment} />{c.attachment.split("/").pop()}</a>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Izohlar yo'q. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>}
                </div>
              </CardContent>
            </Card>
          </FixedTab>

          <FixedTab value="proofs">
            <FileTab
              title="Dalillar"
              rows={proofs}
              kind="proofs"
              loading={proofsLoading}
              pendingFile={pendingProofFile}
              pendingText={pendingProofComment}
              setPendingFile={setPendingProofFile}
              setPendingText={setPendingProofComment}
              uploading={uploadingProof}
              editId={editProofId}
              editText={editProofComment}
              setEditId={setEditProofId}
              setEditText={setEditProofComment}
              setEditFile={setEditProofFile}
              saving={savingProof}
              onPaste={(e) => handlePaste(e, "proofs")}
              onPendingPreview={setFullscreenImage}
              onSubmit={submitProof}
              onSave={saveProof}
              onOpen={(row) => isImage(row.file) ? openProofPreview(proofs, row) : openFile(row)}
              onPreview={(row) => openProofPreview(proofs, row)}
              onDelete={deleteFile}
            />
          </FixedTab>

          <FixedTab value="history">
            <Card className="flex h-full min-h-0 flex-col">
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />O'zgartirish tarixi</CardTitle></CardHeader>
              <CardContent className="min-h-0 flex-1">
                <div className="h-full overflow-y-auto pr-2">
                  {historyLoading ? (
                    <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : history.length ? (
                    <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-5 before:w-px before:bg-muted">
                      {history.map((h) => {
                        const authorName = h.changed_by ? fullName(h.changed_by) : h.changed_by_id ? `Foydalanuvchi #${h.changed_by_id}` : "Foydalanuvchi";
                        const executorName = h.executor ? fullName(h.executor) : null;
                        const reviewerName = h.reviewer ? fullName(h.reviewer) : null;
                        return (
                          <div key={h.id} className="relative flex gap-4">
                            <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background bg-muted text-muted-foreground"><History className="h-4 w-4" /></div>
                            <div className="flex-1 rounded-lg border bg-card p-4 text-sm">
                              <div className="font-medium">{authorName}</div>
                              {h.created_at && <div className="text-xs text-muted-foreground">{format(parseISO(h.created_at), "MMM d, yyyy HH:mm")}</div>}
                              {h.note && <div className="mt-3 rounded bg-muted/50 p-2 text-xs text-muted-foreground">{h.note}</div>}
                              <div className="mt-3 space-y-1 rounded bg-muted/30 p-2 text-xs">
                                {executorName && <div><span className="text-muted-foreground">Ijrochi:</span> <span className="font-medium">{executorName}</span></div>}
                                {reviewerName && <div><span className="text-muted-foreground">Tekshiruvchi:</span> <span className="font-medium">{reviewerName}</span></div>}
                                {h.gennis_executor_name && <div><span className="text-muted-foreground">Gennis Ijrochi:</span> <span className="font-medium">{h.gennis_executor_name}</span></div>}
                                {h.gennis_reviewer_name && <div><span className="text-muted-foreground">Gennis Tekshiruvchi:</span> <span className="font-medium">{h.gennis_reviewer_name}</span></div>}
                                {h.turon_executor_name && <div><span className="text-muted-foreground">Turon Ijrochi:</span> <span className="font-medium">{h.turon_executor_name}</span></div>}
                                {h.turon_reviewer_name && <div><span className="text-muted-foreground">Turon Tekshiruvchi:</span> <span className="font-medium">{h.turon_reviewer_name}</span></div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Tarix mavjud emas yoki topilmadi</p>}
                </div>
              </CardContent>
            </Card>
          </FixedTab>
        </Tabs>
      </div>

      <Dialog open={!!selectedSubtask} onOpenChange={(open) => { if (!open) closeSubtaskProfile(); }}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:h-[90dvh] sm:max-h-[90dvh] sm:max-w-5xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">{selectedSubtask?.title ?? "Kichik vazifa"}</DialogTitle>
          </DialogHeader>
          {selectedSubtask && (
            <>
              <div className="max-h-[38dvh] shrink-0 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3 sm:max-h-none sm:overflow-visible">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={editSubtaskStatus} onValueChange={setEditSubtaskStatus} disabled={subtaskSaving || !canUpdateSubtaskProgress(selectedSubtask)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{allStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Muddat</Label>
                    <Input className="h-9" type="date" value={editSubtaskDeadline} onChange={(e) => setEditSubtaskDeadline(e.target.value)} disabled={subtaskSaving || !canEditSubtasks} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ijrochi</Label>
                    <div className="h-9 truncate rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      {selectedSubtask.executor_name || (selectedSubtask.executor ? fullName(selectedSubtask.executor) : "") || "Ijrochi belgilanmagan"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Holat</Label>
                    <div className={cn("h-9 truncate rounded-md border px-3 py-2 text-sm", selectedSubtask.is_overdue ? "border-destructive/30 bg-destructive/10 text-destructive" : "text-muted-foreground")}>
                      {selectedSubtask.deadline
                        ? selectedSubtask.is_overdue
                          ? `${Math.abs(selectedSubtask.days_left ?? 0)} kun kechikdi`
                          : typeof selectedSubtask.days_left === "number"
                            ? `${selectedSubtask.days_left} kun qoldi`
                            : "Muddat belgilangan"
                        : "Muddat belgilanmagan"}
                    </div>
                  </div>
                </div>
                {(canEditSubtasks || editSubtaskDescription.trim()) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tavsif</Label>
                    <Textarea className="min-h-16" value={editSubtaskDescription} onChange={(e) => setEditSubtaskDescription(e.target.value)} placeholder="Kichik vazifa tavsifi" disabled={subtaskSaving || !canEditSubtasks} />
                  </div>
                )}
                <div className="flex justify-end">
                  {canUpdateSubtaskProgress(selectedSubtask) && <Button onClick={saveSubtaskProfile} disabled={subtaskSaving}>{subtaskSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Saqlash"}</Button>}
                </div>
              </div>

              <Tabs defaultValue="comments" className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <TabsList className="flex h-auto shrink-0 flex-wrap justify-start">
                  <TabsTrigger value="attachments">Ilovalar ({selectedSubtask.attachments_count ?? subtaskAttachments.length})</TabsTrigger>
                  <TabsTrigger value="comments">Izohlar ({selectedSubtask.comments_count ?? subtaskComments.length})</TabsTrigger>
                  <TabsTrigger value="proofs">Dalillar ({selectedSubtask.proofs_count ?? subtaskProofs.length})</TabsTrigger>
                </TabsList>

              <FixedTab value="attachments">
                <FileTab
                  title="Kichik vazifa ilovalari"
                  rows={subtaskAttachments}
                  kind="attachments"
                  loading={subtaskAttachmentsLoading}
                  pendingFile={pendingSubtaskAttFile}
                  pendingText={pendingSubtaskAttNote}
                  setPendingFile={setPendingSubtaskAttFile}
                  setPendingText={setPendingSubtaskAttNote}
                  uploading={uploadingSubtaskAtt}
                  editId={editSubtaskAttId}
                  editText={editSubtaskAttNote}
                  setEditId={setEditSubtaskAttId}
                  setEditText={setEditSubtaskAttNote}
                  setEditFile={setEditSubtaskAttFile}
                  saving={savingSubtaskAtt}
                  canCreate={canAddSubtaskRecords(selectedSubtask)}
                  canEdit={canEditSubtasks}
                  onPaste={(e) => handlePaste(e, "subtask-attachments")}
                  onPendingPreview={setFullscreenImage}
                  onSubmit={submitSubtaskAttachment}
                  onSave={saveSubtaskAttachment}
                  onOpen={openFile}
                  onPreview={(row) => setPreviewAtt(row)}
                  onDelete={deleteSubtaskFile}
                />
              </FixedTab>

              <FixedTab value="comments">
                <Card onPaste={(e) => handlePaste(e, "subtask-comments")} tabIndex={0} className="flex h-full min-h-0 flex-col overflow-hidden outline-none">
                  <CardHeader className="shrink-0"><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Kichik vazifa izohlari</CardTitle></CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                    {showSubtaskCommentForm && canAddSubtaskRecords(selectedSubtask) ? (
                      <div className="shrink-0 space-y-2 rounded-md border p-3">
                        <Textarea value={subtaskCommentText} onChange={(e) => setSubtaskCommentText(e.target.value)} placeholder="Izoh yozing..." onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) sendSubtaskComment(); }} disabled={sendingSubtaskComment} />
                        {subtaskCommentFile && <PendingFilePreview file={subtaskCommentFile} onClear={() => setSubtaskCommentFile(null)} onPreview={setFullscreenImage} />}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                            <Paperclip className="h-4 w-4" />
                            <input type="file" className="hidden" onChange={(e) => setSubtaskCommentFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
                          </label>
                          <span className="min-w-32 flex-1 text-xs text-muted-foreground">Ctrl+Enter — yuborish</span>
                          <Button variant="outline" size="sm" onClick={() => { setShowSubtaskCommentForm(false); setSubtaskCommentText(""); setSubtaskCommentFile(null); }} disabled={sendingSubtaskComment}>Bekor</Button>
                          <Button size="sm" onClick={sendSubtaskComment} disabled={(!subtaskCommentText.trim() && !subtaskCommentFile) || sendingSubtaskComment}>{sendingSubtaskComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yuborish"}</Button>
                        </div>
                      </div>
                    ) : canAddSubtaskRecords(selectedSubtask) ? (
                      <Button variant="ghost" onClick={() => setShowSubtaskCommentForm(true)} className="w-fit shrink-0"><Plus className="mr-1 h-4 w-4" />Izoh qo'shish</Button>
                    ) : null}
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
                      {subtaskCommentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : subtaskComments.length ? subtaskComments.map((c) => (
                        <div key={c.id} className="group flex gap-3 rounded-md border p-3">
                          <Avatar className="h-8 w-8"><AvatarFallback>{personLabel(c.user, c.user_id).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{personLabel(c.user, c.user_id)}</span>
                              {c.created_at && <span className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, HH:mm")}</span>}
                              {canEditSubtasks && String(user?.id) === String(c.user_id) && editSubtaskCommentId !== c.id && (
                                <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <Button variant="ghost" size="icon" onClick={() => { setEditSubtaskCommentId(c.id); setEditSubtaskCommentText(c.text); setEditSubtaskCommentFile(null); }}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteSubtaskComment(c)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                            {editSubtaskCommentId === c.id && canEditSubtasks ? (
                              <div className="mt-2 space-y-2">
                                <Textarea value={editSubtaskCommentText} onChange={(e) => setEditSubtaskCommentText(e.target.value)} disabled={savingSubtaskComment} />
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    <Paperclip className="h-4 w-4" />
                                    <input type="file" className="hidden" onChange={(e) => setEditSubtaskCommentFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
                                  </label>
                                  {editSubtaskCommentFile && <span className="flex min-w-32 flex-1 items-center gap-1 truncate text-xs text-muted-foreground">{editSubtaskCommentFile.name}<button onClick={() => setEditSubtaskCommentFile(null)}><X className="h-3 w-3" /></button></span>}
                                  <Button variant="outline" size="sm" onClick={() => setEditSubtaskCommentId(null)} disabled={savingSubtaskComment}>Bekor</Button>
                                  <Button size="sm" onClick={() => saveSubtaskComment(c)} disabled={!editSubtaskCommentText.trim() || savingSubtaskComment}>{savingSubtaskComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Saqlash"}</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.text}</p>
                                {c.attachment && (
                                  isImage(c.attachment) ? (
                                    <img src={attachmentUrl(c.attachment)} alt="attachment" className="mt-2 max-h-40 cursor-pointer rounded border object-cover" onClick={() => setPreviewCommentFile(attachmentUrl(c.attachment!))} />
                                  ) : (
                                    <a className="mt-2 inline-flex items-center gap-2 rounded border px-2 py-1 text-sm text-primary hover:underline" href={attachmentUrl(c.attachment)} target="_blank" rel="noreferrer"><FileIcon url={c.attachment} />{c.attachment.split("/").pop()}</a>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Izohlar yo'q. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>}
                    </div>
                  </CardContent>
                </Card>
              </FixedTab>

              <FixedTab value="proofs">
                <FileTab
                  title="Kichik vazifa dalillari"
                  rows={subtaskProofs}
                  kind="proofs"
                  loading={subtaskProofsLoading}
                  pendingFile={pendingSubtaskProofFile}
                  pendingText={pendingSubtaskProofComment}
                  setPendingFile={setPendingSubtaskProofFile}
                  setPendingText={setPendingSubtaskProofComment}
                  uploading={uploadingSubtaskProof}
                  editId={editSubtaskProofId}
                  editText={editSubtaskProofComment}
                  setEditId={setEditSubtaskProofId}
                  setEditText={setEditSubtaskProofComment}
                  setEditFile={setEditSubtaskProofFile}
                  saving={savingSubtaskProof}
                  canCreate={canAddSubtaskRecords(selectedSubtask)}
                  canEdit={canEditSubtasks}
                  onPaste={(e) => handlePaste(e, "subtask-proofs")}
                  onPendingPreview={setFullscreenImage}
                  onSubmit={submitSubtaskProof}
                  onSave={saveSubtaskProof}
                  onOpen={(row) => isImage(row.file) ? openProofPreview(subtaskProofs, row) : openFile(row)}
                  onPreview={(row) => openProofPreview(subtaskProofs, row)}
                  onDelete={deleteSubtaskFile}
                />
              </FixedTab>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Vazifani yakunlash</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Yakunlash sanasi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !finishDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {finishDate ? format(finishDate, "dd.MM.yyyy") : "Sanani tanlang"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={finishDate} onSelect={setFinishDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={completeLoading}>Bekor qilish</Button>
            <Button onClick={completeTask} disabled={!finishDate || completeLoading}>{completeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yakunlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={redirectOpen} onOpenChange={(open) => {
        setRedirectOpen(open);
        if (!open) { setNewExecutorId(""); setRedirectSearch(""); setRedirectExpanded(new Set()); setRedirectPickerOpen(false); }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Vazifani yo'naltirish</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Yangi ijrochi</Label>
            {isOwnerRedirect ? (
              <Popover open={redirectPickerOpen} onOpenChange={(v) => { setRedirectPickerOpen(v); if (!v) setRedirectSearch(""); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className={cn("truncate", !newExecutorId && "text-muted-foreground")}>
                      {newExecutorId ? redirectPool.get(Number(newExecutorId))?.name ?? "Tanlangan" : "Tanlang..."}
                    </span>
                    <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex h-80 w-72 flex-col p-1" align="start" onWheel={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center gap-2 border-b px-2 py-1.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Qidirish..."
                      value={redirectSearch}
                      onChange={(e) => setRedirectSearch(e.target.value)}
                      autoFocus
                    />
                    {redirectSearch && (
                      <button onClick={() => setRedirectSearch("")} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {[
                      { key: "pms", label: "Loyiha Menejerlari", users: redirectProjectManagers },
                      { key: "sls", label: "Bo'lim Boshliqlari", users: redirectSectionLeaders },
                      { key: "unassigned", label: "Bo'limsiz xodimlar", users: redirectUnassignedUsers },
                    ].map(({ key, label, users }) => {
                      const q = redirectSearch.toLowerCase();
                      const filtered = users.filter((u) => !q || fullName(u).toLowerCase().includes(q));
                      if (filtered.length === 0) return null;
                      const isExpanded = redirectSearch ? true : redirectExpanded.has(key);
                      return (
                        <div key={key}>
                          <button
                            type="button"
                            className="flex w-full select-none items-center gap-1.5 rounded px-2 py-2 text-left text-sm font-semibold hover:bg-accent"
                            onClick={() => {
                              if (redirectSearch) return;
                              setRedirectExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            <Globe className="h-3.5 w-3.5 text-primary" />
                            {label}
                            <span className="ml-auto text-xs font-normal text-muted-foreground">{filtered.length} ta</span>
                          </button>
                          {isExpanded && (
                            <div className="pl-4">
                              {filtered.map((u) => {
                                const isCurrent = String(u.id) === String(task?.executorId);
                                const isSelected = String(u.id) === newExecutorId;
                                return (
                                  <button
                                    type="button"
                                    key={u.id}
                                    disabled={isCurrent}
                                    onClick={() => { setNewExecutorId(String(u.id)); setRedirectPickerOpen(false); setRedirectSearch(""); }}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                                      isSelected && "bg-accent",
                                      isCurrent && "cursor-not-allowed opacity-50",
                                    )}
                                  >
                                    <span className="flex-1 truncate">{fullName(u)}</span>
                                    {isCurrent && <Badge variant="secondary" className="shrink-0 text-[10px]">Joriy ijrochi</Badge>}
                                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Select value={newExecutorId} onValueChange={setNewExecutorId}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>{redirectOptions.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedirectOpen(false)} disabled={redirectLoading}>Bekor qilish</Button>
            <Button onClick={redirectTask} disabled={!newExecutorId || redirectLoading}>{redirectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yo'naltirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageDialog
        rows={previewAtt ? [previewAtt] : []}
        index={0}
        onClose={() => setPreviewAtt(null)}
        onNavigate={() => {}}
      />
      <ImageDialog
        rows={previewProof?.rows ?? []}
        index={previewProof?.index ?? 0}
        onClose={() => setPreviewProof(null)}
        onNavigate={(index) => setPreviewProof((prev) => (prev ? { ...prev, index } : prev))}
      />
      {previewCommentFile && <ImageUrlDialog title="Rasm" url={previewCommentFile} onClose={() => setPreviewCommentFile(null)} />}
      {fullscreenImage && <ImageUrlDialog title="Rasm ko'rish" url={fullscreenImage} onClose={() => setFullscreenImage(null)} />}
    </DashboardLayout>
  );
}

function ScrollTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-0 min-h-0 flex-1 overflow-hidden">
      <div className="h-full space-y-4 overflow-y-auto pr-2">{children}</div>
    </TabsContent>
  );
}

function FixedTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-0 min-h-0 flex-1 overflow-hidden">
      <div className="h-full min-h-0 overflow-hidden pr-2">{children}</div>
    </TabsContent>
  );
}

function PendingFilePreview({ file, onClear, onPreview }: { file: File; onClear: () => void; onPreview: (url: string) => void }) {
  const preview = getFilePreviewUrl(file);
  return (
    <div className="space-y-2 rounded border p-2 text-sm">
      {preview && <img src={preview} alt="Preview" className="max-h-64 cursor-pointer rounded border object-contain" onClick={() => onPreview(preview)} />}
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileIcon url={file.name} />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        <button onClick={onClear}><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function FileTab({
  title,
  rows,
  kind,
  loading,
  pendingFile,
  pendingText,
  setPendingFile,
  setPendingText,
  uploading,
  editId,
  editText,
  setEditId,
  setEditText,
  setEditFile,
  saving,
  editable,
  canCreate,
  canEdit,
  onPaste,
  onPendingPreview,
  onSubmit,
  onSave,
  onOpen,
  onPreview,
  onDelete,
}: {
  title: string;
  rows: FileRow[];
  kind: "attachments" | "proofs";
  loading: boolean;
  pendingFile: File | null;
  pendingText: string;
  setPendingFile: (file: File | null) => void;
  setPendingText: (text: string) => void;
  uploading: boolean;
  editId: number | null;
  editText: string;
  setEditId: (id: number | null) => void;
  setEditText: (text: string) => void;
  setEditFile: (file: File | null) => void;
  saving: boolean;
  editable?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  onPaste: (e: React.ClipboardEvent) => void;
  onPendingPreview: (url: string) => void;
  onSubmit: () => void;
  onSave: (row: FileRow) => void;
  onOpen: (row: FileRow) => void;
  onPreview: (row: FileRow) => void;
  onDelete: (kind: "attachments" | "proofs", row: FileRow) => void;
}) {
  const noteLabel = kind === "attachments" ? "Izoh (note)" : "Izoh (comment)";
  const uploadLabel = kind === "attachments" ? "Fayl yuklash" : "Dalil yuklash";
  const allowCreate = canCreate ?? editable ?? true;
  const allowEdit = canEdit ?? editable ?? true;

  return (
    <Card onPaste={onPaste} tabIndex={0} className="flex h-full min-h-0 flex-col overflow-hidden outline-none">
      <CardHeader className="shrink-0"><CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" />{title}</CardTitle></CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {allowCreate && pendingFile ? (
          <div className="shrink-0 space-y-2 rounded-md border p-3">
            <PendingFilePreview file={pendingFile} onClear={() => { setPendingFile(null); setPendingText(""); }} onPreview={onPendingPreview} />
            <Input value={pendingText} onChange={(e) => setPendingText(e.target.value)} placeholder="Izoh (ixtiyoriy)" disabled={uploading} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPendingFile(null); setPendingText(""); }} disabled={uploading}>Bekor</Button>
              <Button size="sm" onClick={onSubmit} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yuklash"}</Button>
            </div>
          </div>
        ) : allowCreate ? (
          <label className={cn("inline-flex w-fit shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent", uploading && "pointer-events-none opacity-50")}>
            <Upload className="h-4 w-4" />
            {uploadLabel}
            <input type="file" className="hidden" onChange={(e) => { setPendingFile(e.target.files?.[0] ?? null); setPendingText(""); e.currentTarget.value = ""; }} disabled={uploading} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.odt,.ods,.odp" />
          </label>
        ) : null}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length ? rows.map((row) => (
            <div key={row.id} className="group rounded-md border text-sm">
              {editId === row.id ? (
                <div className="space-y-2 p-3">
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)} placeholder={noteLabel} disabled={saving} />
                  <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-4 w-4" />
                    Faylni almashtirish
                    <input type="file" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.odt,.ods,.odp" />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditId(null); setEditFile(null); }} disabled={saving}>Bekor</Button>
                    <Button size="sm" onClick={() => onSave(row)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Saqlash"}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 hover:bg-accent/40">
                  {isImage(row.file) ? <button onClick={() => onPreview(row)}><FileImage className="h-4 w-4 text-blue-500" /></button> : <FileIcon url={row.file} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{fileName(row)}</div>
                    {(row.note || row.comment) && <div className="truncate text-xs text-muted-foreground">{row.note || row.comment}</div>}
                    {(row.created_at || row.uploaded_at) && (
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(row.created_at ?? row.uploaded_at!), "MMM d, HH:mm")}
                        {row.uploaded_by && ` · ${row.uploaded_by}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" onClick={() => onOpen(row)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" asChild><a href={attachmentUrl(row.file)} download={fileName(row)}><Download className="h-4 w-4" /></a></Button>
                    {allowEdit && <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setEditText(row.note ?? row.comment ?? ""); setEditFile(null); }}><Pencil className="h-4 w-4" /></Button>}
                    {allowEdit && <Button variant="ghost" size="icon" onClick={() => onDelete(kind, row)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              )}
            </div>
          )) : <p className="text-sm text-muted-foreground">{title} yo'q. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ImageDialog({ rows, index, onClose, onNavigate }: { rows: FileRow[]; index: number; onClose: () => void; onNavigate: (index: number) => void }) {
  const row = rows[index];
  const hasPrev = index > 0;
  const hasNext = index < rows.length - 1;

  useEffect(() => {
    if (!row) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [row, index, hasPrev, hasNext, onNavigate]);

  if (!row || !isImage(row.file)) return null;
  return (
    <Dialog open={!!row} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] p-2 sm:max-w-4xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="truncate text-sm">
            {fileName(row)}
            {rows.length > 1 && <span className="ml-2 text-muted-foreground">({index + 1}/{rows.length})</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="relative flex max-h-[80vh] items-center justify-center overflow-auto rounded bg-muted">
          {hasPrev && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full shadow"
              onClick={() => onNavigate(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <img src={attachmentUrl(row.file)} alt={fileName(row)} className="h-auto max-w-full object-contain" />
          {hasNext && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full shadow"
              onClick={() => onNavigate(index + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {(row.note || row.comment) && <p className="px-1 text-xs text-muted-foreground">{row.note || row.comment}</p>}
        <div className="flex items-center justify-between pt-1">
          {rows.length > 1 ? (
            <div className="flex gap-1">
              {rows.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  aria-label={`${i + 1}-rasm`}
                  onClick={() => onNavigate(i)}
                  className={cn("h-1.5 w-1.5 rounded-full transition-colors", i === index ? "bg-primary" : "bg-muted-foreground/30")}
                />
              ))}
            </div>
          ) : <div />}
          <Button variant="outline" size="sm" asChild><a href={attachmentUrl(row.file)} download={fileName(row)}><Download className="mr-1 h-3 w-3" />Yuklab olish</a></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageUrlDialog({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  return (
    <Dialog open={!!url} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] p-2 sm:max-w-4xl">
        <DialogHeader className="pb-1"><DialogTitle className="text-sm">{title}</DialogTitle></DialogHeader>
        <div className="flex max-h-[80vh] items-center justify-center overflow-auto rounded bg-muted">
          <img src={url} alt={title} className="h-auto max-w-full object-contain" />
        </div>
        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Yopish</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

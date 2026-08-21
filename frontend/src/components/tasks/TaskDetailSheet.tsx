import { Task } from "@/data/mockData";
import { apiFetch, apiFetchForm, attachmentUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { roleRank } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ChevronDown,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  TrendingUp,
  TrendingDown,
  Repeat,
  Paperclip,
  MessageSquare,
  ShieldCheck,
  ListChecks,
  Loader2,
  ArrowRightLeft,
  CheckCircle2,
  Trash2,
  X,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Upload,
  Pencil,
  History,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Subtask {
  id: number;
  title: string;
  is_done: boolean;
  order: number;
  executor_id?: number | null;
  executor_name?: string | null;
}

interface Attachment {
  id: number;
  file: string;
  note?: string;
  original_name?: string;
}

interface Proof {
  id: number;
  file: string;
  comment?: string;
  original_name?: string;
  uploaded_by?: string;
  created_at?: string;
}

interface Comment {
  id: number;
  user_id: number;
  text: string;
  attachment?: string | null;
  created_at?: string;
  user?: string;
}

interface TaskUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  born_date: string;
  age: number;
  job_id: number;
  salary: number;
  role: string;
  is_active: boolean;
}

interface TaskHistory {
  id: number;
  mission_id: number;
  changed_by_id: number;
  executor_id: number;
  reviewer_id: number;
  gennis_executor_id: number;
  gennis_executor_name: string;
  gennis_reviewer_id: number;
  gennis_reviewer_name: string;
  turon_executor_id: number;
  turon_executor_name: string;
  turon_reviewer_id: number;
  turon_reviewer_name: string;
  note: string;
  created_at: string;
  changed_by: TaskUser | null;
  executor: TaskUser | null;
  reviewer: TaskUser | null;
}

function getFileExt(url: string) {
  return (url.split("?")[0].split(".").pop() || "").toLowerCase();
}

function isImage(url: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(getFileExt(url));
}

function isPdf(url: string) {
  return getFileExt(url) === "pdf";
}

function isOffice(url: string) {
  return ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(getFileExt(url));
}

function FileIcon({ url }: { url: string }) {
  const ext = getFileExt(url);
  if (isImage(url)) return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />;
  if (isPdf(url)) return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />;
  if (["doc", "docx", "odt"].includes(ext)) return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function getFileName(att: Attachment) {
  if (att.original_name) return att.original_name;
  return att.file.split("/").pop()?.split("?")[0] || att.file;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: "Boshlanmagan", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Jarayonda", className: "bg-info/10 text-info border-info/30" },
  blocked: { label: "Bloklangan", className: "bg-warning/10 text-warning border-warning/30" },
  completed: { label: "Bajarildi", className: "bg-success/10 text-success border-success/30" },
  approved: { label: "Tasdiqlandi", className: "bg-success/10 text-success border-success/30" },
  declined: { label: "Rad etildi", className: "bg-destructive/10 text-destructive border-destructive/30" },
  recheck: { label: "Qayta tekshirish", className: "bg-info/10 text-info border-info/30" },
  done: { label: "Bajarildi", className: "bg-success/10 text-success border-success/30" },
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
];

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

interface TaskDetailSheetProps {
  task: Task | null;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDetailSheet({ task, onClose, onUpdate }: TaskDetailSheetProps) {
  const { user } = useAuth();
  const [statusLoading, setStatusLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);
  const [finishDate, setFinishDate] = useState<Date>();
  const [completeLoading, setCompleteLoading] = useState(false);
  const [newExecutorId, setNewExecutorId] = useState("");
  const [redirectedById, setRedirectedById] = useState("");
  const [redirectLoading, setRedirectLoading] = useState(false);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskExecutorId, setNewSubtaskExecutorId] = useState("");
  const [subtaskUsers, setSubtaskUsers] = useState<{ id: number; name: string }[]>([]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskExecutorId, setEditingSubtaskExecutorId] = useState<number | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const [editAttId, setEditAttId] = useState<number | null>(null);
  const [editAttNote, setEditAttNote] = useState("");
  const [editAttFile, setEditAttFile] = useState<File | null>(null);
  const [savingAtt, setSavingAtt] = useState(false);
  const [pendingAttFile, setPendingAttFile] = useState<File | null>(null);
  const [pendingAttNote, setPendingAttNote] = useState("");
  const [attachmentsContainerRef, setAttachmentsContainerRef] = useState<HTMLDivElement | null>(null);

  // Proofs state
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [previewProof, setPreviewProof] = useState<Proof | null>(null);
  const [editProofId, setEditProofId] = useState<number | null>(null);
  const [editProofComment, setEditProofComment] = useState("");
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [savingProof, setSavingProof] = useState(false);
  const [pendingProofFile, setPendingProofFile] = useState<File | null>(null);
  const [pendingProofComment, setPendingProofComment] = useState("");
  const [proofsContainerRef, setProofsContainerRef] = useState<HTMLDivElement | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [previewCommentFile, setPreviewCommentFile] = useState<string | null>(null);
  const [editCommentId, setEditCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editCommentFile, setEditCommentFile] = useState<File | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [commentsContainerRef, setCommentsContainerRef] = useState<HTMLDivElement | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<TaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Project Members for Redirect Tool
  const [projectMembers, setProjectMembers] = useState<{ id: number; name: string; surname?: string }[]>([]);
  const [allUsers, setAllUsers] = useState<TaskUser[]>([]);

  useEffect(() => {
    if (!task) return;
    setSubtasksLoading(true);
    apiFetch(`/missions/${task.id}/subtasks/`)
      .then((r) => r.ok ? r.json() : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data) => setSubtasks((Array.isArray(data) ? data : []).map((s: any) => ({
        ...s,
        executor_id: s.executor_id ?? s.executor?.id ?? null,
        executor_name: s.executor_name ?? (s.executor ? `${s.executor.name ?? ""} ${s.executor.surname ?? ""}`.trim() || null : null),
      }))))
      .catch(() => { })
      .finally(() => setSubtasksLoading(false));

    setAttachmentsLoading(true);
    apiFetch(`/missions/${task.id}/attachments/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAttachments(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setAttachmentsLoading(false));

    setCommentsLoading(true);
    apiFetch(`/missions/${task.id}/comments/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setCommentsLoading(false));

    setProofsLoading(true);
    apiFetch(`/missions/${task.id}/proofs/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProofs(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setProofsLoading(false));

    setHistoryLoading(true);
    apiFetch(`/missions/${task.id}/history`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (data && Array.isArray(data.results)) {
          setHistoryItems(data.results);
        } else if (Array.isArray(data)) {
          setHistoryItems(data);
        }
      })
      .catch(() => { })
      .finally(() => setHistoryLoading(false));

  }, [task?.id]);

  useEffect(() => {
    if (!showRedirect) {
      setProjectMembers([]);
      setAllUsers([]);
      return;
    }

    if (user?.role === "manager") {
      // For managers: fetch only members of their own sections/projects
      apiFetch(`/users/${user.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then(async (profile) => {
          if (!profile) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sectionIds: number[] = (profile.sections ?? []).map((s: any) => s.id ?? s).filter(Number.isInteger);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const projectIds: number[] = (profile.projects ?? []).map((p: any) => p.id ?? p).filter(Number.isInteger);

          const memberMap = new Map<number, { id: number; name: string; surname: string; role: string }>();

          await Promise.all([
            ...sectionIds.map((sid) =>
              apiFetch(`/sections/${sid}/members`)
                .then((r) => r.ok ? r.json() : [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((data) => (Array.isArray(data) ? data : []).forEach((m: any) => {
                  const u = m.user ?? m;
                  if (u?.id) memberMap.set(u.id, { id: u.id, name: u.name ?? "", surname: u.surname ?? "", role: u.role ?? "" });
                }))
                .catch(() => { })
            ),
            ...projectIds.map((pid) =>
              apiFetch(`/projects/${pid}/members`)
                .then((r) => r.ok ? r.json() : [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((data) => (Array.isArray(data) ? data : []).forEach((m: any) => {
                  const u = m.user ?? m;
                  if (u?.id) memberMap.set(u.id, { id: u.id, name: u.name ?? "", surname: u.surname ?? "", role: u.role ?? "" });
                }))
                .catch(() => { })
            ),
          ]);

          const members = Array.from(memberMap.values());
          setProjectMembers(members);
          setAllUsers(members as unknown as TaskUser[]);
        })
        .catch(() => {
          setProjectMembers([]);
          setAllUsers([]);
        });
    } else {
      // For other roles: original behavior
      if (task?.project_id) {
        apiFetch(`/projects/${task.project_id}/members`)
          .then((r) => r.json())
          .then((data) => {
            const list = Array.isArray(data) ? data : (data.items || data.users || []);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const members = list.map((m: any) => m.user).filter(Boolean);
            setProjectMembers(members);
          })
          .catch(() => setProjectMembers([]));
      } else {
        setProjectMembers([]);
      }

      apiFetch("/users/")
        .then((r) => r.json())
        .then((data) => setAllUsers(Array.isArray(data) ? data : []))
        .catch(() => setAllUsers([]));
    }
  }, [showRedirect, user?.role, user?.id, task?.project_id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPendingAttFile(file);
    setPendingAttNote("");
  };

  const handleSubmitAttachment = async () => {
    if (!pendingAttFile || !task) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingAttFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingAttNote.trim()) fd.append("note", pendingAttNote.trim());
      const res = await apiFetchForm(`/missions/${task.id}/attachments/`, fd);
      if (!res.ok) { toast.error("Fayl yuklab bo'lmadi"); return; }
      const created: Attachment = await res.json();
      setAttachments((prev) => [...prev, created]);
      setPendingAttFile(null);
      setPendingAttNote("");
      toast.success("Fayl yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (!task) return;
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/attachments/${att.id}`, { method: "DELETE" });
      if (!res.ok) {
        setAttachments((prev) => [...prev, att]);
        toast.error("O'chirib bo'lmadi");
      }
    } catch {
      setAttachments((prev) => [...prev, att]);
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const handleUploadProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPendingProofFile(file);
    setPendingProofComment("");
  };

  const handleSubmitProof = async () => {
    if (!pendingProofFile || !task) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingProofFile);
      fd.append("creator_id", String(user?.id ?? 1));
      if (pendingProofComment.trim()) fd.append("comment", pendingProofComment.trim());
      const res = await apiFetchForm(`/missions/${task.id}/proofs/`, fd);
      if (!res.ok) { toast.error("Dalil yuklab bo'lmadi"); return; }
      const created: Proof = await res.json();
      setProofs((prev) => [...prev, created]);

      // Clean up preview URL
      if (pendingProofFile.type.startsWith("image/")) {
        const previewUrl = getFilePreviewUrl(pendingProofFile);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }

      setPendingProofFile(null);
      setPendingProofComment("");
      toast.success("Dalil yuklandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleProofsPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !task) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPendingProofFile(file);
          setPendingProofComment("");
          toast.success("Rasm qo'shildi");
        }
        return;
      }
    }
  };

  const handleAttachmentsPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !task) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPendingAttFile(file);
          setPendingAttNote("");
          toast.success("Rasm qo'shildi");
        }
        return;
      }
    }
  };

  const handleCommentsPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !task) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setCommentFile(file);
          if (!showCommentForm) {
            setShowCommentForm(true);
          }
          toast.success("Rasm qo'shildi");
        }
        return;
      }
    }
  };

  const getFilePreviewUrl = (file: File): string | null => {
    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const handleDeleteProof = async (proof: Proof) => {
    if (!task) return;
    setProofs((prev) => prev.filter((p) => p.id !== proof.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/proofs/${proof.id}`, { method: "DELETE" });
      if (!res.ok) {
        setProofs((prev) => [...prev, proof]);
        toast.error("O'chirib bo'lmadi");
      }
    } catch {
      setProofs((prev) => [...prev, proof]);
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const handleSaveAttachment = async (att: Attachment) => {
    if (!task) return;
    setSavingAtt(true);
    try {
      const fd = new FormData();
      if (editAttFile) fd.append("file", editAttFile);
      fd.append("note", editAttNote);
      const res = await apiFetchForm(`/missions/${task.id}/attachments/${att.id}`, fd, "PATCH");
      if (!res.ok) { toast.error("O'zgartirib bo'lmadi"); return; }
      const updated: Attachment = await res.json();
      setAttachments((prev) => prev.map((a) => a.id === att.id ? updated : a));
      setEditAttId(null);
      setEditAttFile(null);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingAtt(false);
    }
  };

  const handleSaveProof = async (proof: Proof) => {
    if (!task) return;
    setSavingProof(true);
    try {
      const fd = new FormData();
      if (editProofFile) fd.append("file", editProofFile);
      fd.append("comment", editProofComment);
      const res = await apiFetchForm(`/missions/${task.id}/proofs/${proof.id}`, fd, "PATCH");
      if (!res.ok) { toast.error("O'zgartirib bo'lmadi"); return; }
      const updated: Proof = await res.json();
      setProofs((prev) => prev.map((p) => p.id === proof.id ? updated : p));
      setEditProofId(null);
      setEditProofFile(null);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingProof(false);
    }
  };

  const handleSaveComment = async (comment: Comment) => {
    if (!task || !editCommentText.trim()) return;
    setSavingComment(true);
    try {
      const fd = new FormData();
      fd.append("text", editCommentText.trim());
      if (editCommentFile) fd.append("attachment", editCommentFile);
      const res = await apiFetchForm(`/missions/${task.id}/comments/${comment.id}`, fd, "PATCH");
      if (!res.ok) { toast.error("O'zgartirib bo'lmadi"); return; }
      const updated: Comment = await res.json();
      setComments((prev) => prev.map((c) => c.id === comment.id ? updated : c));
      setEditCommentId(null);
      setEditCommentFile(null);
      toast.success("Yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSavingComment(false);
    }
  };

  const handleSendComment = async () => {
    if ((!commentText.trim() && !commentFile) || !task || !user) return;
    setSendingComment(true);
    try {
      const fd = new FormData();
      fd.append("user_id", String(user.id));
      fd.append("text", commentText.trim());
      if (commentFile) fd.append("attachment", commentFile);
      const res = await apiFetchForm(`/missions/${task.id}/comments/`, fd);
      if (!res.ok) { toast.error("Izoh yuborib bo'lmadi"); return; }
      const created: Comment = await res.json();
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setCommentFile(null);
      setShowCommentForm(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    if (!task) return;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/comments/${comment.id}`, { method: "DELETE" });
      if (!res.ok) {
        setComments((prev) => [...prev, comment]);
        toast.error("O'chirib bo'lmadi");
      }
    } catch {
      setComments((prev) => [...prev, comment]);
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const openAttachment = (att: Attachment) => {
    const url = attachmentUrl(att.file);
    if (isImage(att.file)) { setPreviewAtt(att); return; }
    if (isPdf(att.file)) { window.open(url, "_blank"); return; }
    if (isOffice(att.file)) {
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}`, "_blank");
      return;
    }
    window.open(url, "_blank");
  };

  const handleEditSubtask = async (subtask: Subtask, newTitle: string) => {
    const trimmed = newTitle.trim();
    setEditingSubtaskId(null);
    if (!trimmed || trimmed === subtask.title || !task) return;
    setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? { ...s, title: trimmed } : s));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed, is_done: subtask.is_done, order: subtask.order }),
      });
      if (!res.ok) {
        setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
        toast.error("O'zgartirib bo'lmadi");
      }
    } catch {
      setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const handleEditSubtaskExecutor = async (subtask: Subtask, executorId: string) => {
    if (!task) return;
    setEditingSubtaskExecutorId(null);
    const newExecutorId = (executorId && executorId !== "__none__") ? Number(executorId) : null;
    const newName = newExecutorId
      ? subtaskUsers.find((u) => u.id === newExecutorId)?.name ?? null
      : null;
    const optimistic = { ...subtask, executor_id: newExecutorId, executor_name: newName };
    setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? optimistic : s));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: subtask.title,
          is_done: subtask.is_done,
          order: subtask.order,
          executor_id: newExecutorId,
        }),
      });
      if (!res.ok) {
        setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
        toast.error("Ijrochi o'zgartirib bo'lmadi");
      }
    } catch {
      setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  useEffect(() => {
    if (!task || !user?.id) {
      setSubtaskUsers([]);
      return;
    }

    if (user.role === "manager") {
      apiFetch(`/users/${user.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then(async (profile) => {
          if (!profile) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sectionIds: number[] = (profile.sections ?? []).map((s: any) => s.id ?? s).filter(Number.isInteger);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const projectIds: number[] = (profile.projects ?? []).map((p: any) => p.id ?? p).filter(Number.isInteger);
          const memberMap = new Map<number, { id: number; name: string }>();

          // Include self
          memberMap.set(Number(user.id), { id: Number(user.id), name: `${user.name} ${user.surname ?? ""}`.trim() });

          await Promise.all([
            ...sectionIds.map((sid) =>
              apiFetch(`/sections/${sid}/members`)
                .then((r) => r.ok ? r.json() : [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((data) => (Array.isArray(data) ? data : []).forEach((m: any) => {
                  const u = m.user ?? m;
                  if (u?.id) memberMap.set(u.id, { id: u.id, name: `${u.name ?? ""} ${u.surname ?? ""}`.trim() });
                }))
                .catch(() => { })
            ),
            ...projectIds.map((pid) =>
              apiFetch(`/projects/${pid}/members`)
                .then((r) => r.ok ? r.json() : [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((data) => (Array.isArray(data) ? data : []).forEach((m: any) => {
                  const u = m.user ?? m;
                  if (u?.id) memberMap.set(u.id, { id: u.id, name: `${u.name ?? ""} ${u.surname ?? ""}`.trim() });
                }))
                .catch(() => { })
            ),
          ]);

          setSubtaskUsers(Array.from(memberMap.values()));
        })
        .catch(() => setSubtaskUsers([]));
    } else {
      apiFetch("/users/")
        .then((r) => r.ok ? r.json() : [])
        .then((data: TaskUser[]) => {
          const all = Array.isArray(data) ? data : [];
          const self = { id: Number(user.id), name: `${user.name} ${user.surname ?? ""}`.trim() };
          const filtered = all
            .filter((u) => roleRank(u.role) < roleRank(user.role))
            .map((u) => ({ id: u.id, name: `${u.name} ${u.surname}`.trim() }));
          const map = new Map([[self.id, self], ...filtered.map((u) => [u.id, u] as [number, { id: number; name: string }])]);
          setSubtaskUsers(Array.from(map.values()));
        })
        .catch(() => setSubtaskUsers([]));
    }
  }, [task?.id, user?.id, user?.role]);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task) return;
    setAddingSubtask(true);
    try {
      const body: Record<string, unknown> = { title: newSubtaskTitle.trim(), order: subtasks.length + 1 };
      if (newSubtaskExecutorId) body.executor_id = Number(newSubtaskExecutorId);
      const res = await apiFetch(`/missions/${task.id}/subtasks/?creator_id=${user?.id ?? 1}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Kichik vazifa qo'shib bo'lmadi"); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await res.json();
      const created: Subtask = {
        ...raw,
        executor_id: raw.executor_id ?? raw.executor?.id ?? null,
        executor_name: raw.executor_name ?? (raw.executor ? `${raw.executor.name ?? ""} ${raw.executor.surname ?? ""}`.trim() || null : null),
      };
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
      setNewSubtaskExecutorId("");
      setShowAddSubtask(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!task) return;
    const updated = { ...subtask, is_done: !subtask.is_done };
    setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? updated : s));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: subtask.title, is_done: updated.is_done, order: subtask.order }),
      });
      if (!res.ok) {
        setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
        toast.error("O'zgartirib bo'lmadi");
      }
    } catch {
      setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? subtask : s));
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const handleDeleteSubtask = async (subtask: Subtask) => {
    if (!task) return;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
    try {
      const res = await apiFetch(`/missions/${task.id}/subtasks/${subtask.id}`, { method: "DELETE" });
      if (!res.ok) {
        setSubtasks((prev) => [...prev, subtask].sort((a, b) => a.order - b.order));
        toast.error("O'chirib bo'lmadi");
      }
    } catch {
      setSubtasks((prev) => [...prev, subtask].sort((a, b) => a.order - b.order));
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  if (!task) return null;

  const isCreator = Boolean(user && (String(task.creatorId) === String(user.id)));
  const isReviewer = Boolean(user && (String(task.reviewerId) === String(user.id)));
  const isExecutor = Boolean(user && (String(task.executorId) === String(user.id)));

  const allowedStatuses = new Set<string>([task.status]);
  if (isCreator || user?.role === "owner" || user?.role === "admin") {
    allStatuses.forEach(s => allowedStatuses.add(s.value));
  } else {
    if (isExecutor && STATUS_PERMISSIONS.executor[task.status]) {
      STATUS_PERMISSIONS.executor[task.status].forEach(s => allowedStatuses.add(s));
    }
    if (isReviewer && STATUS_PERMISSIONS.reviewer[task.status]) {
      STATUS_PERMISSIONS.reviewer[task.status].forEach(s => allowedStatuses.add(s));
    }
  }

  const availableStatusOptions = allStatuses.filter(s => allowedStatuses.has(s.value));

  const sc = statusConfig[task.status] ?? statusConfig["not_started"];
  const isOverdue = task.status === "overdue";
  const overdueDays = isOverdue ? differenceInDays(new Date(), parseISO(task.deadline)) : 0;

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await apiFetch(`/missions/${task.id}/status?status=${newStatus}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        toast.error("Statusni o'zgartirib bo'lmadi");
        return;
      }
      onUpdate({ ...task, status: newStatus as Task["status"] });
      toast.success("Status o'zgartirildi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!finishDate) return;
    setCompleteLoading(true);
    try {
      const dateStr = format(finishDate, "yyyy-MM-dd");
      const res = await apiFetch(`/missions/${task.id}/complete?finish_date=${dateStr}`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Vazifani yakunlab bo'lmadi");
        return;
      }
      onUpdate({ ...task, status: "completed" as Task["status"] });
      toast.success("Vazifa yakunlandi");
      setShowComplete(false);
      setFinishDate(undefined);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleRedirect = async () => {
    if (!newExecutorId || !user) {
      toast.error("Yangi ijrochini tanlang");
      return;
    }
    setRedirectLoading(true);
    try {
      const res = await apiFetch(
        `/missions/${task.id}/redirect?new_executor_id=${newExecutorId}&redirected_by_id=${user.id}`,
        { method: "PATCH" }
      );
      if (!res.ok) {
        toast.error("Yo'naltirib bo'lmadi");
        return;
      }
      toast.success("Vazifa yo'naltirildi");
      setShowRedirect(false);
      setNewExecutorId("");
      setRedirectedById("");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setRedirectLoading(false);
    }
  };

  return (
    <>
      <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="p-6 pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge variant="outline" className={deptColors[task.department]}>
                  {task.department.toUpperCase()}
                </Badge>
                <SheetTitle className="text-lg">{task.title}</SheetTitle>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
              </div>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-5">
            {isOverdue && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {overdueDays} kun kechikdi
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {statusLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Select value={task.status} onValueChange={handleStatusChange} disabled={statusLoading || availableStatusOptions.length <= 1}>
                  <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isCreator && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowComplete(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Yakunlash
                </Button>
              )}
              {roleRank(user?.role) >= roleRank("manager") && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowRedirect(true)}>
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Yo'naltirish
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowHistory(true)}>
                <History className="h-3.5 w-3.5" />
                O'zgartirish tarixi
              </Button>
            </div>

            <Separator />

            {/* People */}
            <div className="grid grid-cols-3 gap-3">
              <PersonCard label="Yaratuvchi" name={task.creator} />
              <PersonCard label="Ijrochi" name={task.executor} />
              <PersonCard label="Tekshiruvchi" name={task.reviewer} />
            </div>

            {/* Detail Cards */}
            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                icon={<CalendarIcon className="h-4 w-4" />}
                label="Muddat"
                value={task.deadline}
                className={isOverdue ? "text-destructive" : ""}
                mono
              />
              <DetailCard
                icon={<Clock className="h-4 w-4" />}
                label="Yaratildi"
                value={format(parseISO(task.createdAt), "MMM d, HH:mm")}
                mono
              />
              <DetailCard
                icon={task.kpiWeight >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                label="KPI og'irligi"
                value={`${task.kpiWeight > 0 ? "+" : ""}${task.kpiWeight}`}
                mono
              />
              <DetailCard
                icon={<Repeat className="h-4 w-4" />}
                label="Takroriy"
                value={task.recurring ? `${task.recurringType} / ${task.repeatEvery}` : "Yo'q"}
              />
            </div>

            <Separator />

            {/* Description */}
            <div>
              <p className="text-sm font-medium mb-2">Tavsif</p>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>

            {/* Subtasks */}
            <CollapsibleSection
              icon={<ListChecks className="h-4 w-4" />}
              title={`Kichik vazifalar (${subtasks.filter(s => s.is_done).length}/${subtasks.length})`}
              defaultOpen
            >
              {subtasksLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : subtasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Kichik vazifalar yo'q</p>
              ) : (
                <div className="space-y-2">
                  {subtasks.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 group">
                      <Checkbox className="mt-0.5" checked={s.is_done} onCheckedChange={() => handleToggleSubtask(s)} />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {editingSubtaskId === s.id ? (
                          <Input
                            autoFocus
                            className="h-6 text-sm py-0 px-1"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => handleEditSubtask(s, editingSubtaskTitle)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSubtask(s, editingSubtaskTitle);
                              if (e.key === "Escape") setEditingSubtaskId(null);
                            }}
                          />
                        ) : (
                          <span
                            className={`text-sm block cursor-pointer select-none ${s.is_done ? "line-through text-muted-foreground" : ""}`}
                            onDoubleClick={() => { setEditingSubtaskId(s.id); setEditingSubtaskTitle(s.title); }}
                            title="Tahrirlash uchun ikki marta bosing"
                          >
                            {s.title}
                          </span>
                        )}
                        {editingSubtaskExecutorId === s.id && subtaskUsers.length > 0 ? (
                          <Select
                            defaultOpen
                            value={s.executor_id ? String(s.executor_id) : ""}
                            onValueChange={(val) => handleEditSubtaskExecutor(s, val)}
                            onOpenChange={(open) => { if (!open) setEditingSubtaskExecutorId(null); }}
                          >
                            <SelectTrigger className="h-5 text-[10px] px-1.5 w-full">
                              <SelectValue placeholder="Ijrochi tanlang" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs text-muted-foreground">— Ijrochisiz</SelectItem>
                              {subtaskUsers.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">
                              {s.executor_name || "Ijrochi belgilanmagan"}
                            </span>
                            {subtaskUsers.length > 0 && roleRank(user?.role) >= roleRank("manager") && (
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={() => setEditingSubtaskExecutorId(s.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {(roleRank(user?.role) >= roleRank("manager") || !s.executor_id) && (
                        <button
                          onClick={() => handleDeleteSubtask(s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {showAddSubtask ? (
                <div className="mt-2 space-y-2">
                  <Input
                    autoFocus
                    className="h-7 text-xs"
                    placeholder="Kichik vazifa nomi"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") { setShowAddSubtask(false); setNewSubtaskTitle(""); setNewSubtaskExecutorId(""); } }}
                    disabled={addingSubtask}
                  />
                  {subtaskUsers.length > 0 && roleRank(user?.role) >= roleRank("manager") && (
                    <Select value={newSubtaskExecutorId} onValueChange={setNewSubtaskExecutorId} disabled={addingSubtask}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Ijrochi (ixtiyoriy)" />
                      </SelectTrigger>
                      <SelectContent>
                        {subtaskUsers.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim() || addingSubtask}>
                      {addingSubtask ? <Loader2 className="h-3 w-3 animate-spin" /> : "Qo'sh"}
                    </Button>
                    <button onClick={() => { setShowAddSubtask(false); setNewSubtaskTitle(""); setNewSubtaskExecutorId(""); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setShowAddSubtask(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Kichik vazifa qo'shish
                </Button>
              )}
            </CollapsibleSection>

            {/* Attachments */}
            <CollapsibleSection
              icon={<Paperclip className="h-4 w-4" />}
              title={`Ilovalar (${attachments.length})`}
            >
              <div
                ref={setAttachmentsContainerRef}
                onPaste={handleAttachmentsPaste}
                tabIndex={0}
                className="outline-none"
              >
                {attachmentsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ilovalar yo'q. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>
                ) : (
                <div className="space-y-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="border rounded text-xs">
                      {editAttId === a.id ? (
                        <div className="p-2 space-y-2">
                          <Input
                            autoFocus
                            className="h-7 text-xs"
                            placeholder="Izoh (note)"
                            value={editAttNote}
                            onChange={(e) => setEditAttNote(e.target.value)}
                            disabled={savingAtt}
                          />
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span>{editAttFile ? editAttFile.name : "Faylni almashtirish"}</span>
                              <input type="file" className="hidden" onChange={(e) => setEditAttFile(e.target.files?.[0] ?? null)} />
                            </label>
                            {editAttFile && <button onClick={() => setEditAttFile(null)}><X className="h-3 w-3" /></button>}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setEditAttId(null); setEditAttFile(null); }} disabled={savingAtt}>Bekor</Button>
                            <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleSaveAttachment(a)} disabled={savingAtt}>
                              {savingAtt ? <Loader2 className="h-3 w-3 animate-spin" /> : "Saqlash"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group p-2 hover:bg-accent/40 transition-colors">
                          <FileIcon url={a.file} />
                          <span className="truncate flex-1 font-medium">{getFileName(a)}</span>
                          {a.note && <span className="text-muted-foreground truncate max-w-[80px]">{a.note}</span>}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => openAttachment(a)} className="text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                            <a href={attachmentUrl(a.file)} download={getFileName(a)} className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                            <button onClick={() => { setEditAttId(a.id); setEditAttNote(a.note ?? ""); setEditAttFile(null); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDeleteAttachment(a)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {pendingAttFile ? (
                <div className="mt-2 border rounded p-2 space-y-2 text-xs">
                  {getFilePreviewUrl(pendingAttFile) && (
                    <div className="relative w-full max-w-xs mx-auto group">
                      <img
                        src={getFilePreviewUrl(pendingAttFile)!}
                        alt="Preview"
                        className="w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setFullscreenImage(getFilePreviewUrl(pendingAttFile)!)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black/50 rounded-full p-2">
                          <Eye className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate">{pendingAttFile.name}</span>
                  </div>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Izoh (ixtiyoriy)"
                    value={pendingAttNote}
                    onChange={(e) => setPendingAttNote(e.target.value)}
                    disabled={uploadingFile}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setPendingAttFile(null); setPendingAttNote(""); }} disabled={uploadingFile}>Bekor</Button>
                    <Button size="sm" className="h-6 text-xs px-2" onClick={handleSubmitAttachment} disabled={uploadingFile}>
                      {uploadingFile ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yuklash"}
                    </Button>
                  </div>
                </div>
              ) : (
                <label className={`mt-2 inline-flex items-center gap-1 h-7 px-2 text-xs rounded cursor-pointer hover:bg-accent transition-colors ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="h-3 w-3" />
                  Fayl yuklash
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.odt,.ods,.odp" />
                </label>
              )}
              </div>
            </CollapsibleSection>

            {/* Comments */}
            <CollapsibleSection
              icon={<MessageSquare className="h-4 w-4" />}
              title={`Izohlar (${comments.length})`}
              defaultOpen={comments.length > 0}
            >
              <div
                ref={setCommentsContainerRef}
                onPaste={handleCommentsPaste}
                tabIndex={0}
                className="outline-none"
              >
                {commentsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Izohlar yo'q. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>
                ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {(() => {
                            const name = typeof c.user === "object" && c.user
                              ? `${c.user.name ?? ""} ${c.user.surname ?? ""}`.trim()
                              : String(c.user_id);
                            return name.slice(0, 2).toUpperCase();
                          })()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {typeof c.user === "object" && c.user
                              ? `${c.user.name ?? ""} ${c.user.surname ?? ""}`.trim()
                              : `#${c.user_id}`}
                          </span>
                          {c.created_at && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {format(parseISO(c.created_at), "MMM d, HH:mm")}
                            </span>
                          )}
                          {String(user?.id) === String(c.user_id) && editCommentId !== c.id && (
                            <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditCommentId(c.id); setEditCommentText(c.text); setEditCommentFile(null); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                              <button onClick={() => handleDeleteComment(c)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          )}
                        </div>

                        {editCommentId === c.id ? (
                          <div className="mt-1 space-y-1.5">
                            <textarea
                              autoFocus
                              className="w-full text-xs border rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                              rows={3}
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSaveComment(c); if (e.key === "Escape") setEditCommentId(null); }}
                              disabled={savingComment}
                            />
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer text-muted-foreground hover:text-foreground" title="Fayl biriktirish">
                                <Paperclip className="h-3.5 w-3.5" />
                                <input type="file" className="hidden" onChange={(e) => setEditCommentFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
                              </label>
                              {editCommentFile && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 truncate flex-1">
                                  {editCommentFile.name}
                                  <button onClick={() => setEditCommentFile(null)}><X className="h-3 w-3" /></button>
                                </span>
                              )}
                              <div className="flex gap-1 ml-auto">
                                <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setEditCommentId(null)} disabled={savingComment}>Bekor</Button>
                                <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleSaveComment(c)} disabled={!editCommentText.trim() || savingComment}>
                                  {savingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : "Saqlash"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">{c.text}</p>
                            {c.attachment && (
                              <div className="mt-1">
                                {isImage(c.attachment) ? (
                                  <img src={attachmentUrl(c.attachment)} alt="attachment" className="max-h-32 rounded cursor-pointer border object-cover" onClick={() => setPreviewCommentFile(attachmentUrl(c.attachment!))} />
                                ) : (
                                  <a href={attachmentUrl(c.attachment)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border rounded px-2 py-1">
                                    <FileIcon url={c.attachment} />
                                    {c.attachment.split("/").pop()}
                                  </a>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showCommentForm ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    autoFocus
                    className="w-full text-xs border rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                    rows={3}
                    placeholder="Izoh yozing..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSendComment(); }}
                    disabled={sendingComment}
                  />
                  {commentFile && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-1">
                      {getFilePreviewUrl(commentFile) ? (
                        <div className="relative w-full max-w-xs mx-auto group">
                          <img
                            src={getFilePreviewUrl(commentFile)!}
                            alt="Preview"
                            className="w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setFullscreenImage(getFilePreviewUrl(commentFile)!)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-black/50 rounded-full p-2">
                              <Eye className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <FileIcon url={commentFile.name} />
                          <span className="truncate flex-1">{commentFile.name}</span>
                        </>
                      )}
                      <button onClick={() => setCommentFile(null)}><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-muted-foreground hover:text-foreground" title="Fayl biriktirish">
                      <Paperclip className="h-4 w-4" />
                      <input type="file" className="hidden" onChange={(e) => setCommentFile(e.target.files?.[0] ?? null)}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
                    </label>
                    <span className="text-[10px] text-muted-foreground flex-1">Ctrl+Enter — yuborish</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowCommentForm(false); setCommentText(""); setCommentFile(null); }} disabled={sendingComment}>
                      Bekor
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSendComment} disabled={(!commentText.trim() && !commentFile) || sendingComment}>
                      {sendingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yuborish"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setShowCommentForm(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Izoh qo'shish
                </Button>
              )}
              </div>
            </CollapsibleSection>

            {/* Proofs */}
            <CollapsibleSection
              icon={<ShieldCheck className="h-4 w-4" />}
              title={`Dalillar (${proofs.length})`}
            >
              <div
                ref={setProofsContainerRef}
                onPaste={handleProofsPaste}
                tabIndex={0}
                className="outline-none"
              >
                {proofsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : proofs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Dalillar yuklanmagan. Rasm yoki faylni bu yerga paste qiling (Ctrl+V)</p>
                ) : (
                  <div className="space-y-2">
                    {proofs.map((p) => (
                      <div key={p.id} className="group border rounded text-xs">
                        {editProofId === p.id ? (
                          <div className="p-2 space-y-2">
                            <Input
                              autoFocus
                              className="h-7 text-xs"
                              placeholder="Izoh (comment)"
                              value={editProofComment}
                              onChange={(e) => setEditProofComment(e.target.value)}
                              disabled={savingProof}
                            />
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <Paperclip className="h-3.5 w-3.5" />
                                <span>{editProofFile ? editProofFile.name : "Faylni almashtirish"}</span>
                                <input type="file" className="hidden" onChange={(e) => setEditProofFile(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                              </label>
                              {editProofFile && <button onClick={() => setEditProofFile(null)}><X className="h-3 w-3" /></button>}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setEditProofId(null); setEditProofFile(null); }} disabled={savingProof}>Bekor</Button>
                              <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleSaveProof(p)} disabled={savingProof}>
                                {savingProof ? <Loader2 className="h-3 w-3 animate-spin" /> : "Saqlash"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 hover:bg-accent/40 transition-colors">
                            {isImage(p.file) ? (
                              <div className="relative">
                                <img src={attachmentUrl(p.file)} alt={getFileName(p)} className="w-full max-h-40 object-cover rounded cursor-pointer" onClick={() => setPreviewProof(p)} />
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditProofId(p.id); setEditProofComment(p.comment ?? ""); setEditProofFile(null); }} className="bg-background/80 rounded p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDeleteProof(p)} className="bg-background/80 rounded p-0.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <FileIcon url={p.file} />
                                <span className="truncate flex-1 font-medium">{getFileName(p)}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => window.open(attachmentUrl(p.file), "_blank")} className="text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                                  <a href={attachmentUrl(p.file)} download={getFileName(p)} className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                                  <button onClick={() => { setEditProofId(p.id); setEditProofComment(p.comment ?? ""); setEditProofFile(null); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDeleteProof(p)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            )}
                            {p.comment && <p className="text-muted-foreground mt-1 pl-0.5">{p.comment}</p>}
                            {p.created_at && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                {format(parseISO(p.created_at), "MMM d, HH:mm")}
                                {p.uploaded_by && ` · ${p.uploaded_by}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {pendingProofFile ? (
                  <div className="mt-2 border rounded p-2 space-y-2 text-xs">
                    {getFilePreviewUrl(pendingProofFile) && (
                      <div className="relative w-full max-w-xs mx-auto group">
                        <img
                          src={getFilePreviewUrl(pendingProofFile)!}
                          alt="Preview"
                          className="w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setFullscreenImage(getFilePreviewUrl(pendingProofFile)!)}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/50 rounded-full p-2">
                            <Eye className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      <span className="truncate">{pendingProofFile.name}</span>
                    </div>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Izoh (ixtiyoriy)"
                      value={pendingProofComment}
                      onChange={(e) => setPendingProofComment(e.target.value)}
                      disabled={uploadingProof}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setPendingProofFile(null); setPendingProofComment(""); }} disabled={uploadingProof}>Bekor</Button>
                      <Button size="sm" className="h-6 text-xs px-2" onClick={handleSubmitProof} disabled={uploadingProof}>
                        {uploadingProof ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yuklash"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className={`mt-2 inline-flex items-center gap-1 h-7 px-2 text-xs rounded cursor-pointer hover:bg-accent transition-colors ${uploadingProof ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="h-3 w-3" />
                    Dalil yuklash
                    <input type="file" className="hidden" onChange={handleUploadProof} disabled={uploadingProof}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" />
                  </label>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </SheetContent>
      </Sheet>

      {/* Complete Dialog */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vazifani yakunlash</DialogTitle>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => setShowComplete(false)} disabled={completeLoading}>Bekor qilish</Button>
            <Button onClick={handleComplete} disabled={!finishDate || completeLoading}>
              {completeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yakunlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redirect Dialog */}
      <Dialog open={showRedirect} onOpenChange={(v) => { setShowRedirect(v); if (!v) { setNewExecutorId(""); setRedirectedById(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vazifani yo'naltirish</DialogTitle>
          </DialogHeader>
          {task && (() => {
            const parsedProjectMembers = projectMembers.map(m => ({
              id: m.id,
              name: m.surname ? `${m.name} ${m.surname}`.trim() : m.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              role: (m as any).role ?? "",
            }));

            let finalOptions: { id: number; name: string }[] = [];

            if (user?.role === "manager") {
              finalOptions = parsedProjectMembers
                .filter((p) => String(p.id) !== String(task.executorId) && String(p.id) !== String(user?.id))
                .filter((p) => roleRank(p.role) < roleRank(user?.role))
                .map((p) => ({ id: p.id, name: p.name }));
            } else if (user?.role === "owner" || user?.role === "admin") {
              const allParticipants = [
                task.creatorId ? { id: task.creatorId, name: task.creator } : null,
                task.executorId ? { id: task.executorId, name: task.executor } : null,
                task.reviewerId ? { id: task.reviewerId, name: task.reviewer } : null,
              ].filter(Boolean) as { id: number; name: string }[];
              const unique = allParticipants.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
              finalOptions = parsedProjectMembers.length > 0
                ? parsedProjectMembers.filter((p) => String(p.id) !== String(task.executorId))
                : unique.filter((p) => String(p.id) !== String(task.executorId));
            } else {
              const managerSectionIds = user?.sections?.map((s: { id: number }) => s.id) || [];
              const deptUsers = allUsers.filter(u => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const uSecs = (u as any).sections?.map((s: any) => s.id) || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return uSecs.some((id: number) => managerSectionIds.includes(id)) || (u as any).department === (user as any).department;
              });
              const combinedMap = new Map();
              projectMembers.forEach((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                combinedMap.set(m.id, { id: m.id, name: m.surname ? `${m.name} ${m.surname}`.trim() : m.name, role: (m as any).role });
              });
              deptUsers.forEach((u) => {
                combinedMap.set(u.id, { id: u.id, name: `${u.name} ${u.surname}`.trim(), role: u.role });
              });
              finalOptions = Array.from(combinedMap.values()).filter(p => {
                if (String(p.id) === String(task.executorId)) return false;
                return roleRank(p.role) < roleRank(user?.role);
              }).map(p => ({ id: p.id, name: p.name }));
            }

            return (
              <div className="space-y-3">
                <div>
                  <Label>Yangi ijrochi</Label>
                  <Select value={newExecutorId} onValueChange={setNewExecutorId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {finalOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedirect(false)} disabled={redirectLoading}>Bekor qilish</Button>
            <Button onClick={handleRedirect} disabled={!newExecutorId || redirectLoading}>
              {redirectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yo'naltirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="pb-1 shrink-0">
            <DialogTitle>O'zgartirish tarixi</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {historyLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground p-4">
                Tarix mavjud emas yoki topilmadi
              </p>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent pt-2 pb-2">
                {historyItems.map((h) => {
                  const authorName = h.changed_by ? `${h.changed_by.name || ""} ${h.changed_by.surname || ""}`.trim() : `Foydalanuvchi #${h.changed_by_id}`;
                  const executorName = h.executor ? `${h.executor.name || ""} ${h.executor.surname || ""}`.trim() : null;
                  const reviewerName = h.reviewer ? `${h.reviewer.name || ""} ${h.reviewer.surname || ""}`.trim() : null;

                  return (
                    <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                        <History className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm leading-tight break-words">{authorName}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {h.created_at ? format(parseISO(h.created_at), "MMM d, yyyy HH:mm") : ""}
                            </p>
                          </div>
                        </div>

                        {h.note && (
                          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            {h.note}
                          </div>
                        )}

                        <div className="flex flex-col gap-1 text-xs bg-muted/30 p-2 rounded">
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
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog (attachments) */}
      {previewAtt && isImage(previewAtt.file) && (
        <Dialog open={!!previewAtt} onOpenChange={() => setPreviewAtt(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-2">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm truncate">{getFileName(previewAtt)}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted rounded overflow-auto max-h-[80vh]">
              <img src={attachmentUrl(previewAtt.file)} alt={getFileName(previewAtt)} className="max-w-full h-auto object-contain" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <a href={attachmentUrl(previewAtt.file)} download={getFileName(previewAtt)}>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Download className="h-3 w-3" /> Yuklab olish
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Dialog (proofs) */}
      {previewProof && isImage(previewProof.file) && (
        <Dialog open={!!previewProof} onOpenChange={() => setPreviewProof(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-2">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm truncate">{getFileName(previewProof)}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted rounded overflow-auto max-h-[80vh]">
              <img src={attachmentUrl(previewProof.file)} alt={getFileName(previewProof)} className="max-w-full h-auto object-contain" />
            </div>
            {previewProof.comment && <p className="text-xs text-muted-foreground px-1">{previewProof.comment}</p>}
            <div className="flex justify-end pt-1">
              <a href={attachmentUrl(previewProof.file)} download={getFileName(previewProof)}>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Download className="h-3 w-3" /> Yuklab olish
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Dialog (comment attachment) */}
      {previewCommentFile && (
        <Dialog open={!!previewCommentFile} onOpenChange={() => setPreviewCommentFile(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-2">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm">Rasm</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted rounded overflow-auto max-h-[80vh]">
              <img src={previewCommentFile} alt="comment attachment" className="max-w-full h-auto object-contain" />
            </div>
            <div className="flex justify-end pt-1">
              <a href={previewCommentFile} download>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Download className="h-3 w-3" /> Yuklab olish
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fullscreen Image Preview for pending proof */}
      {fullscreenImage && (
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-2">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm">Rasm ko'rish</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted rounded overflow-auto max-h-[80vh]">
              <img src={fullscreenImage} alt="Fullscreen preview" className="max-w-full h-auto object-contain" />
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFullscreenImage(null)}>
                Yopish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function PersonCard({ label, name }: { label: string; name: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <Avatar className="h-8 w-8 mx-auto mb-1.5">
          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
        <p className="text-xs font-medium truncate">{name}</p>
      </CardContent>
    </Card>
  );
}

function DetailCard({
  icon,
  label,
  value,
  className = "",
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
        </div>
        <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${className}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium hover:bg-accent rounded px-2 py-1.5 -mx-2 transition-colors">
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown className="h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-6">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

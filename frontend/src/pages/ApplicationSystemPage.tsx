import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Send, Calendar, Building2, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";

interface Branch { id: number; name: string; }

interface RequestComment {
  id: number;
  user_name: string;
  text: string;
  created_at: string;
  request: number;
  user: number;
}

interface AdminRequest {
  id: number;
  name: string;
  description: string;
  deadline: string;
  comment: string;
  source: string;
  status: boolean;
  branch_id: number | null;
  branch_name: string;
  user_id: number;
  user_name: string;
  created_at: string;
  updated_at: string;
  comments?: RequestComment[];
}

interface RequestForm {
  name: string;
  description: string;
  deadline: string;
  comment: string;
}

const emptyForm = (): RequestForm => ({ name: "", description: "", deadline: "", comment: "" });

function deadlineDaysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = deadlineDaysLeft(deadline);
  if (days < 0) return <Badge variant="destructive" className="text-xs">Muddati o'tgan</Badge>;
  if (days <= 3) return <Badge className="text-xs bg-orange-500/15 text-orange-700 border-0">Shoshilinch ({days}k)</Badge>;
  if (days <= 7) return <Badge className="text-xs bg-yellow-500/15 text-yellow-700 border-0">Yaqin ({days}k)</Badge>;
  return <Badge className="text-xs bg-green-500/15 text-green-700 border-0">{days} kun</Badge>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function ApplicationSystemPage() {
  const { user } = useAuth();
  const { institution } = useInstitution();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminRequest | null>(null);

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<RequestForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    setBranchesLoading(true);
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Branch[]) => setBranches(data))
      .finally(() => setBranchesLoading(false));
  }, [institution]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("source", institution);
      if (filterBranch !== "all") {
        const branchParam = institution === "turon" ? "branch_id" : "location_id";
        params.append(branchParam, filterBranch);
      }
      if (filterStatus !== "all") {
        params.append("accepted", filterStatus === "accepted" ? "true" : "false");
      }
      const res = await apiFetch(`/admin-requests/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterBranch, filterStatus, institution]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.deadline) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        deadline: form.deadline,
        comment: form.comment.trim(),
        user: user?.id,
        ...(filterBranch !== "all" && {
          location_id: Number(filterBranch)
        }),
      };
      const res = await apiFetch("/admin-requests/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Xatolik yuz berdi");
        return;
      }
      const created: AdminRequest = await res.json();
      setRequests((prev) => [created, ...prev]);
      toast.success("Talab yaratildi");
      setDialog(false);
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!selected || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const res = await apiFetch("/request-comments/", {
        method: "POST",
        body: JSON.stringify({ request: selected.id, user: user?.id, text: newComment.trim() }),
      });
      if (!res.ok) {
        toast.error("Izoh qo'shib bo'lmadi");
        return;
      }
      const comment: RequestComment = await res.json();
      const updated = { ...selected, comments: [...(selected.comments ?? []), comment] };
      setSelected(updated);
      setRequests((prev) => prev.map((r) => r.id === selected.id ? updated : r));
      setNewComment("");
    } finally {
      setSendingComment(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/admin-requests/${selected.source}/${selected.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: !selected.status }),
      });
      if (!res.ok) {
        toast.error("Holatni o'zgartirib bo'lmadi");
        return;
      }
      const updated: AdminRequest = await res.json();
      setSelected(updated);
      setRequests((prev) => prev.map((r) => r.id === selected.id ? updated : r));
      toast.success(updated.status ? "Qabul qilindi" : "Qabul qilinmadi");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Haqiqatan ham o'chirmoqchimisiz?")) return;
    if (!selected) return;
    const res = await apiFetch(`/admin-requests/${selected.source}/${id}/`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("O'chirildi");
    } else {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const acceptedCount = requests.filter((r) => r.status).length;
  const rejectedCount = requests.filter((r) => !r.status).length;

  return (
    <DashboardLayout
      title="Talablar Tizimi"
      headerExtra={
        <div className="flex items-center gap-2">
          <Select
            value={filterStatus}
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Barcha holatlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holatlar</SelectItem>
              <SelectItem value="accepted">Qabul qilindi</SelectItem>
              <SelectItem value="rejected">Qabul qilinmadi</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterBranch}
            onValueChange={setFilterBranch}
            disabled={branchesLoading}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              {branchesLoading
                ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Yuklanmoqda</span>
                : <SelectValue placeholder="Barcha filiallar" />
              }
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha filiallar</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* <Button size="sm" onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Yangi talab
          </Button> */}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Qabul qilindi</p>
              <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Qabul qilinmadi</p>
              <p className="text-2xl font-bold text-orange-600">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Two-pane layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* List */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Talablar ro'yxati</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p>Talablar topilmadi</p>
                </div>
              ) : (
                <ScrollArea className="h-[480px]">
                  <div className="space-y-0.5 p-2">
                    {requests.map((req) => (
                      <button
                        key={req.id}
                        className={`w-full text-left rounded-lg p-3 transition-colors hover:bg-muted/60 ${selected?.id === req.id ? "bg-muted" : ""}`}
                        onClick={() => setSelected(req)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium text-sm leading-tight">{req.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{formatDate(req.deadline)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{req.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />{req.branch_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />{req.comments?.length ?? 0}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Detail */}
          <Card className="lg:col-span-3">
            {selected ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{selected.name}</CardTitle>
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0 h-7 text-xs"
                      onClick={() => handleDelete(selected.id)}
                    >
                      O'chirish
                    </Button> */}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{formatDate(selected.deadline)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tavsif</p>
                    <p className="text-sm">{selected.description}</p>
                  </div>
                  {selected.comment && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Asosiy komment</p>
                      <p className="text-sm">{selected.comment}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Filial</p>
                      <p className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />{selected.branch_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Yaratuvchi</p>
                      <p className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />{selected.user_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Manba</p>
                      <p>{selected.source}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Holat</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={selected.status ? "default" : "secondary"}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={handleToggleStatus}
                        >
                          {updatingStatus ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          {selected.status ? "Qabul qilindi" : "Qabul qilinmadi"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Yaratilgan</p>
                      <p>{formatDate(selected.created_at)}</p>
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Izohlar ({selected.comments?.length ?? 0})
                    </p>
                    {selected.comments && selected.comments.length > 0 && (
                      <ScrollArea className="h-44 mb-3">
                        <div className="space-y-2 pr-2">
                          {selected.comments.map((c) => (
                            <div key={c.id} className="rounded-lg bg-muted/50 p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{c.user_name}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                              </div>
                              <p className="text-sm">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Izoh qo'shish... (Ctrl+Enter yuborish)"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="resize-none text-sm"
                        rows={2}
                        onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAddComment(); }}
                      />
                      <Button
                        size="icon"
                        className="shrink-0 self-end"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || sendingComment}
                      >
                        {sendingComment
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Send className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Talab tanlang</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) setForm(emptyForm()); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi talab yaratish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nomi <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Masalan: Yangi printer"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tavsif <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Talab haqida batafsil ma'lumot..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>
            <div>
              <Label>Muddat <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </div>
            <div>
              <Label>Komment</Label>
              <Textarea
                placeholder="Ixtiyoriy komment..."
                value={form.comment}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(false); setForm(emptyForm()); }} disabled={saving}>
              Bekor
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { CalendarIcon, Loader2, ChevronDown, X, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface User {
  id: number;
  name: string;
  surname: string;
  role?: string;
}

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  projectId: number;
  projectManagerId: number;
  projectMembers: User[];
}

const defaultForm = {
  title: "",
  description: "",
  category: "academic" as string,
  deadline: undefined as Date | undefined,
  kpi_weight: 10,
  penalty_per_day: 2,
  early_bonus_per_day: 1,
  max_bonus: 3,
  max_penalty: 10,
  is_recurring: false,
  recurring_type: "daily" as string,
  repeat_every: 1,
};

export function ProjectTaskDialog({
  open,
  onOpenChange,
  onCreated,
  projectId,
  projectManagerId,
  projectMembers,
}: ProjectTaskDialogProps) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [form, setForm] = useState(defaultForm);
  const [executorIds, setExecutorIds] = useState<string[]>([]);
  const [reviewerId, setReviewerId] = useState("");
  const [saving, setSaving] = useState(false);

  const [executorOpen, setExecutorOpen] = useState(false);
  const [executorSearch, setExecutorSearch] = useState("");
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [reviewerSearch, setReviewerSearch] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(defaultForm);
      setExecutorIds(isOwner ? [String(projectManagerId)] : []);
      setReviewerId("");
      setExecutorSearch("");
      setReviewerSearch("");
    }
  }, [open, isOwner, projectManagerId]);

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleExecutor = (id: string) => {
    setExecutorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Get available executors: manager + members
  const availableExecutors = [
    projectMembers.find(m => m.id === projectManagerId),
    ...projectMembers.filter(m => m.id !== projectManagerId),
  ].filter(Boolean) as User[];

  // Get available reviewers: owner + manager
  const availableReviewers: User[] = [];
  if (user) availableReviewers.push(user as User);
  const manager = projectMembers.find(m => m.id === projectManagerId);
  if (manager && manager.id !== user?.id) {
    availableReviewers.push(manager);
  }

  const selectedExecutors = availableExecutors.filter((u) =>
    executorIds.includes(String(u.id))
  );

  const selectedReviewer = availableReviewers.find(
    (u) => String(u.id) === reviewerId
  );

  const canSubmit = () => {
    if (!form.title.trim()) return false;
    if (executorIds.length === 0) return false;
    if (!reviewerId) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      if (!form.title.trim()) toast.error("Sarlavha kiritilmagan");
      else if (executorIds.length === 0) toast.error("Ijrochi tanlanmagan");
      else if (!reviewerId) toast.error("Tekshiruvchi tanlanmagan");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        reviewer_id: Number(reviewerId),
        deadline: form.deadline ? format(form.deadline, "yyyy-MM-dd") : null,
        kpi_weight: form.kpi_weight,
        penalty_per_day: form.penalty_per_day,
        early_bonus_per_day: form.early_bonus_per_day,
        max_bonus: form.max_bonus,
        max_penalty: form.max_penalty,
        is_recurring: form.is_recurring,
        recurring_type: form.recurring_type,
        repeat_every: form.repeat_every,
        tag_ids: [],
        channel: "line_management",
        gennis_executor_ids: [],
        turon_executor_ids: [],
        executor_ids: executorIds.map(Number),
        project_id: projectId,
      };

      const res = await apiFetch(`/missions/bulk?creator_id=${user?.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }

      toast.success("Vazifa yaratildi");
      onCreated();
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Loyiha uchun vazifa yaratish</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Sarlavha *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Vazifa sarlavhasi"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Tavsif</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Vazifa tavsifi"
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategoriya</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="administrative">Administrative</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Executor */}
          <div className="space-y-1.5">
            <Label>Ijrochi *</Label>
            <Popover
              open={executorOpen}
              onOpenChange={(v) => {
                setExecutorOpen(v);
                if (!v) setExecutorSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal h-auto min-h-10 py-1.5"
                >
                  {executorIds.length === 0 ? (
                    <span className="text-muted-foreground text-sm">Tanlang</span>
                  ) : executorIds.length === 1 ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <Badge variant="secondary" className="text-xs gap-1 pr-1 max-w-full truncate">
                        <span className="truncate">
                          {selectedExecutors[0]?.name} {selectedExecutors[0]?.surname}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExecutor(String(selectedExecutors[0]?.id));
                          }}
                          className="hover:text-destructive shrink-0"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedExecutors.slice(0, 2).map((u) => (
                        <Badge key={u.id} variant="secondary" className="text-xs gap-1 pr-1">
                          <span className="truncate">
                            {u.name} {u.surname}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExecutor(String(u.id));
                            }}
                            className="hover:text-destructive"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                      {selectedExecutors.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{selectedExecutors.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1 max-h-72 flex flex-col" align="start">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder="Qidirish..."
                    value={executorSearch}
                    onChange={(e) => setExecutorSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {executorSearch && (
                    <button
                      onClick={() => setExecutorSearch("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {availableExecutors
                    .filter((u) => {
                      const q = executorSearch.toLowerCase();
                      return !q || `${u.name} ${u.surname}`.toLowerCase().includes(q);
                    })
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                        onClick={() => toggleExecutor(String(u.id))}
                      >
                        <Checkbox
                          checked={executorIds.includes(String(u.id))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">
                          {u.name} {u.surname}
                          {u.id === projectManagerId && (
                            <span className="text-muted-foreground ml-1">(Menejer)</span>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reviewer */}
          <div className="space-y-1.5">
            <Label>Tekshiruvchi *</Label>
            <Popover
              open={reviewerOpen}
              onOpenChange={(v) => {
                setReviewerOpen(v);
                if (!v) setReviewerSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal h-10 px-3"
                >
                  {!reviewerId ? (
                    <span className="text-muted-foreground text-sm">Tanlang</span>
                  ) : (
                    <span className="text-sm">
                      {selectedReviewer?.name} {selectedReviewer?.surname}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1 max-h-72 flex flex-col" align="start">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder="Qidirish..."
                    value={reviewerSearch}
                    onChange={(e) => setReviewerSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {reviewerSearch && (
                    <button
                      onClick={() => setReviewerSearch("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {availableReviewers
                    .filter((u) => {
                      const q = reviewerSearch.toLowerCase();
                      return !q || `${u.name} ${u.surname}`.toLowerCase().includes(q);
                    })
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setReviewerId(String(u.id));
                          setReviewerOpen(false);
                          setReviewerSearch("");
                        }}
                      >
                        <div
                          className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${
                            reviewerId === String(u.id)
                              ? "bg-primary border-primary"
                              : "border-input"
                          }`}
                        >
                          {reviewerId === String(u.id) && (
                            <div className="h-2 w-2 bg-white rounded-sm" />
                          )}
                        </div>
                        <span className="text-sm">
                          {u.name} {u.surname}
                          {u.id === user?.id && (
                            <span className="text-muted-foreground ml-1">(O'zim)</span>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label>Muddat</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !form.deadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.deadline ? format(form.deadline, "PPP") : "Tanlang"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.deadline}
                  onSelect={(date) => set("deadline", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Takroriy */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="recurring"
              checked={form.is_recurring}
              onCheckedChange={(v) => set("is_recurring", v === true)}
            />
            <Label htmlFor="recurring" className="cursor-pointer">Takroriy</Label>
          </div>

          {form.is_recurring && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <Label>Turi</Label>
                <Select value={form.recurring_type} onValueChange={(v) => set("recurring_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Kunlik</SelectItem>
                    <SelectItem value="weekly">Haftalik</SelectItem>
                    <SelectItem value="monthly">Oylik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Har nechada</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.repeat_every}
                  onChange={(e) => set("repeat_every", Number(e.target.value))}
                />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yaratish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

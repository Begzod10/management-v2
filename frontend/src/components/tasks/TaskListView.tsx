import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/permissions";
import { Task } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, LayoutList, LayoutGrid, AlertTriangle, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

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

const deptColors: Record<string, string> = {
  admin: "bg-muted text-muted-foreground",
  academic: "bg-info/10 text-info border-info/30",
  finance: "bg-warning/10 text-warning border-warning/30",
  hr: "bg-accent text-accent-foreground",
};

type TabValue = "my" | "assigned" | "reviewer" | "overdue" | "today" | "all" | "stats";

interface TaskListViewProps {
  tasks: Task[];
  loading: boolean;
  tab: TabValue;
  onTabChange: (tab: TabValue) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  deptFilter: string;
  onDeptFilterChange: (val: string) => void;
  onSelectTask: (task: Task) => void;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => Promise<void>;
  statsContent?: React.ReactNode;
}

export function TaskListView({ tasks, loading, tab, onTabChange, statusFilter, onStatusFilterChange, deptFilter, onDeptFilterChange, onSelectTask, onCreateTask, onEditTask, onDeleteTask, statsContent }: TaskListViewProps) {
  const { user } = useAuth();
  const canCreate = canDo(user?.role, "task_create");
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const [view, setView] = useState<"table" | "card">("table");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // Only frontend filter: search. (Status, dept, and tab are backend-filtered).
  const filtered = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchExecutor = t.executor?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchExecutor) return false;
    }
    return true;
  });

  // still apply overdue/today visually from returned data
  const displayed = tab === "overdue"
    ? filtered.filter((t) => {
        const isOverdueStatus = t.status === "overdue";
        const isPastDeadline = t.deadline && t.deadline < today && t.status !== "done" && t.status !== "completed" && t.status !== "approved";
        return isOverdueStatus || !!isPastDeadline;
      })
    : tab === "today"
      ? filtered.filter((t) => t.deadline === today)
      : filtered; // "all", "my", "assigned", "reviewer" — show as-is

  const sortedDisplayed = [...displayed].sort((a, b) => {
    if (!user) return 0;
    const aSelf = String(a.creatorId) === String(user.id) && String(a.executorId) === String(user.id);
    const bSelf = String(b.creatorId) === String(user.id) && String(b.executorId) === String(user.id);
    if (aSelf && !bSelf) return 1;
    if (!aSelf && bSelf) return -1;
    return 0;
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await onDeleteTask(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as TabValue)} className="w-full min-w-0">
          <TabsList className="w-full overflow-x-auto justify-start flex-nowrap">
            {isOwner && (
              <TabsTrigger value="all" className="shrink-0">Hamma vazifalar</TabsTrigger>
            )}
            <TabsTrigger value="my" className="shrink-0">Mening vazifalarim</TabsTrigger>
            <TabsTrigger value="assigned" className="shrink-0">Men topshirganlar</TabsTrigger>
            <TabsTrigger value="reviewer" className="shrink-0">Tekshirish uchun</TabsTrigger>
            <TabsTrigger value="overdue" className="shrink-0">Muddati o'tgan</TabsTrigger>
            <TabsTrigger value="today" className="shrink-0">Bugun</TabsTrigger>
            <TabsTrigger value="stats" className="shrink-0">Statistika</TabsTrigger>
          </TabsList>
        </Tabs>
        {canCreate && tab !== "stats" && (
          <Button onClick={onCreateTask} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Vazifa yaratish
          </Button>
        )}
      </div>

      {tab !== "stats" && <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Vazifalarni qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-56 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            {(() => {
              if (tab === "reviewer") {
                return (
                  <>
                    <SelectItem value="completed">Bajarildi</SelectItem>
                    <SelectItem value="approved">Tasdiqlandi</SelectItem>
                    <SelectItem value="declined">Rad etildi</SelectItem>
                    <SelectItem value="recheck">Qayta tekshirish</SelectItem>
                    <SelectItem value="overdue">Muddati o'tgan</SelectItem>
                  </>
                );
              }
              if (tab === "all" || tab === "assigned") {
                return (
                  <>
                    <SelectItem value="not_started">Boshlanmagan</SelectItem>
                    <SelectItem value="in_progress">Jarayonda</SelectItem>
                    <SelectItem value="blocked">Bloklangan</SelectItem>
                    <SelectItem value="completed">Bajarildi</SelectItem>
                    <SelectItem value="approved">Tasdiqlandi</SelectItem>
                    <SelectItem value="declined">Rad etildi</SelectItem>
                    <SelectItem value="recheck">Qayta tekshirish</SelectItem>
                    <SelectItem value="overdue">Muddati o'tgan</SelectItem>
                  </>
                );
              }
              return (
                <>
                  <SelectItem value="not_started">Boshlanmagan</SelectItem>
                  <SelectItem value="in_progress">Jarayonda</SelectItem>
                  <SelectItem value="blocked">Bloklangan</SelectItem>
                  <SelectItem value="completed">Bajarildi</SelectItem>
                  <SelectItem value="recheck">Qayta tekshirish</SelectItem>
                </>
              );
            })()}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={onDeptFilterChange}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Bo'lim" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha bo'limlar</SelectItem>
            <SelectItem value="admin">Ma'muriyat</SelectItem>
            <SelectItem value="academic">Akademik</SelectItem>
            <SelectItem value="finance">Moliya</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setView("table")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "card" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setView("card")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>}

      {tab === "stats" ? (
        <div className="flex-1 overflow-auto min-h-0">{statsContent}</div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Vazifalar yuklanmoqda...</p>
            </div>
          ) : sortedDisplayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutList className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Vazifalar topilmadi</p>
              {canCreate && (
                <Button onClick={onCreateTask} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Vazifa yaratish
                </Button>
              )}
            </div>
          ) : view === "table" ? (
            <TableView tasks={sortedDisplayed} onSelectTask={onSelectTask} onEdit={onEditTask} onDelete={setDeleteTarget} />
          ) : (
            <CardView tasks={sortedDisplayed} onSelectTask={onSelectTask} onEdit={onEditTask} onDelete={setDeleteTarget} />
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vazifani o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">"{deleteTarget?.title}"</span> vazifasini o'chirishni tasdiqlaysizmi? Bu amalni bekor qilib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "O'chirilmoqda..." : "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OverdueBanner({ deadline }: { deadline: string }) {
  const days = differenceInDays(new Date(), parseISO(deadline));
  if (days <= 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <AlertTriangle className="h-3 w-3" />
      {days} kun kechikdi
    </span>
  );
}

function ActionMenu({ task, onEdit, onDelete }: { task: Task; onEdit: (t: Task) => void; onDelete: (t: Task) => void }) {
  const { user } = useAuth();
  const isCreator = user && String(task.creatorId) === String(user.id);
  if (!isCreator) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Tahrirlash
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" /> O'chirish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableView({ tasks, onSelectTask, onEdit, onDelete }: {
  tasks: Task[];
  onSelectTask: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vazifa</TableHead>
            <TableHead className="hidden sm:table-cell">Bo'lim</TableHead>
            <TableHead className="hidden md:table-cell">Ijrochi</TableHead>
            <TableHead>Muddat</TableHead>
            <TableHead>Holat</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const sc = statusConfig[task.status] ?? { label: task.status, className: "bg-muted text-muted-foreground" };
            const dc = deptColors[task.department] ?? "bg-muted text-muted-foreground";
            const isOverdue = task.status === "overdue";
            return (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-accent/50 group"
                onClick={() => onSelectTask(task)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    {isOverdue && <OverdueBanner deadline={task.deadline} />}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className={dc}>{(task.department ?? "").toUpperCase()}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{task.executor}</TableCell>
                <TableCell>
                  <span className={`font-mono text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                    {task.deadline}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                </TableCell>
                <TableCell>
                  <ActionMenu task={task} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CardView({ tasks, onSelectTask, onEdit, onDelete }: {
  tasks: Task[];
  onSelectTask: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((task) => {
        const sc = statusConfig[task.status] ?? { label: task.status, className: "bg-muted text-muted-foreground" };
        const dc = deptColors[task.department] ?? "bg-muted text-muted-foreground";
        const isOverdue = task.status === "overdue";
        return (
          <Card key={task.id} className="cursor-pointer hover:border-muted-foreground/30 transition-colors group" onClick={() => onSelectTask(task)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2">
                  <Badge variant="outline" className={dc}>{(task.department ?? "").toUpperCase()}</Badge>
                  <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                </div>
                <ActionMenu task={task} onEdit={onEdit} onDelete={onDelete} />
              </div>
              <p className="font-medium text-sm">{task.title}</p>
              {isOverdue && <OverdueBanner deadline={task.deadline} />}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{task.executor}</span>
                <span className={`font-mono ${isOverdue ? "text-destructive" : ""}`}>{task.deadline}</span>
              </div>
              {task.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

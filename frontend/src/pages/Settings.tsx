import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/permissions";

interface Branch { id: number; name: string; system_model_id?: number; }
interface Job { id: number; name: string; desc: string; }
interface SystemModel { id: number; name: string; desc: string; }

// ─── Generic CRUD Table ───────────────────────────────────────────────────────

interface CrudTableProps<T extends { id: number }> {
  items: T[];
  loading: boolean;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  renderRow: (item: T) => React.ReactNode;
  headers: string[];
  showActions?: boolean;
}

function CrudTable<T extends { id: number }>({
  items, loading, onEdit, onDelete, renderRow, headers, showActions = false,
}: CrudTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Ma'lumot yo'q</p>;
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-12">#</th>
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
            ))}
            {showActions && <th className="w-20" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
              {renderRow(item)}
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDelete({ open, name, loading, onConfirm, onCancel }: {
  open: boolean; name: string; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">"{name}"</span>ni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            O'chirish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── System Models Tab ────────────────────────────────────────────────────────

function SystemModelsTab() {
  const [items, setItems] = useState<SystemModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SystemModel | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SystemModel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/system-models/");
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(""); setDesc(""); setDialogOpen(true); };
  const openEdit = (item: SystemModel) => { setEditing(item); setName(item.name); setDesc(item.desc); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ name, desc });
      const res = editing
        ? await apiFetch(`/system-models/${editing.id}`, { method: "PATCH", body })
        : await apiFetch("/system-models/", { method: "POST", body });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editing ? "Tizim yangilandi" : "Tizim yaratildi");
      setDialogOpen(false);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/system-models/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Tizim o'chirildi");
      setDeleteTarget(null);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <CrudTable
        items={items}
        loading={loading}
        headers={["Nomi", "Tavsif"]}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        renderRow={(item) => (
          <>
            <td className="px-4 py-3 font-medium">{item.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{item.desc}</td>
          </>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Tizimni tahrirlash" : "Yangi tizim"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tizim nomi" autoFocus />
            </div>
            <div>
              <Label>Tavsif</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Qisqacha tavsif" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Branches Tab ─────────────────────────────────────────────────────────────

function BranchesTab() {
  const [items, setItems] = useState<Branch[]>([]);
  const [systemModels, setSystemModels] = useState<SystemModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [systemModelId, setSystemModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [branchRes, sysRes] = await Promise.all([
        apiFetch("/branches/"),
        apiFetch("/system-models/"),
      ]);
      if (branchRes.ok) setItems(await branchRes.json());
      if (sysRes.ok) setSystemModels(await sysRes.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(""); setSystemModelId(""); setDialogOpen(true); };
  const openEdit = (item: Branch) => {
    setEditing(item);
    setName(item.name);
    setSystemModelId(item.system_model_id ? String(item.system_model_id) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ name, system_model_id: Number(systemModelId) || 0 });
      const res = editing
        ? await apiFetch(`/branches/${editing.id}`, { method: "PATCH", body })
        : await apiFetch("/branches/", { method: "POST", body });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editing ? "Filial yangilandi" : "Filial yaratildi");
      setDialogOpen(false);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/branches/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Filial o'chirildi");
      setDeleteTarget(null);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setDeleting(false); }
  };

  const getSystemModelName = (id?: number) =>
    systemModels.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <CrudTable
        items={items}
        loading={loading}
        headers={["Nomi", "Tizim"]}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        renderRow={(item) => (
          <>
            <td className="px-4 py-3 font-medium">{item.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{getSystemModelName(item.system_model_id)}</td>
          </>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Filialni tahrirlash" : "Yangi filial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filial nomi" autoFocus />
            </div>
            <div>
              <Label>Tizim</Label>
              <Select value={systemModelId} onValueChange={setSystemModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tizimni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {systemModels.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobsTab() {
  const { user } = useAuth();
  const canManage = canDo(user?.role, "jobs_manage");

  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/jobs/");
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(""); setDesc(""); setDialogOpen(true); };
  const openEdit = (item: Job) => { setEditing(item); setName(item.name); setDesc(item.desc); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ name, desc });
      const res = editing
        ? await apiFetch(`/jobs/${editing.id}`, { method: "PATCH", body })
        : await apiFetch("/jobs/", { method: "POST", body });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editing ? "Lavozim yangilandi" : "Lavozim yaratildi");
      setDialogOpen(false);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/jobs/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Lavozim o'chirildi");
      setDeleteTarget(null);
      load();
    } catch { toast.error("Serverga ulanib bo'lmadi"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Lavozim qo'shish</Button>
        </div>
      )}
      <CrudTable
        items={items}
        loading={loading}
        headers={["Nomi", "Tavsif"]}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        showActions={canManage}
        renderRow={(item) => (
          <>
            <td className="px-4 py-3 font-medium">{item.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{item.desc}</td>
          </>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Lavozimni tahrirlash" : "Yangi lavozim"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lavozim nomi" autoFocus />
            </div>
            <div>
              <Label>Tavsif</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Qisqacha tavsif" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <DashboardLayout title="Sozlamalar">
      <Tabs defaultValue="system-models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system-models">Tizimlar</TabsTrigger>
          <TabsTrigger value="branches">Filiallar</TabsTrigger>
          <TabsTrigger value="jobs">Lavozimlar</TabsTrigger>
        </TabsList>
        <TabsContent value="system-models"><SystemModelsTab /></TabsContent>
        <TabsContent value="branches"><BranchesTab /></TabsContent>
        <TabsContent value="jobs"><JobsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

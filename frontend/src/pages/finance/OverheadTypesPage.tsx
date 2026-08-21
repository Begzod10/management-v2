import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useInstitution } from "@/contexts/InstitutionContext";

interface OverheadType {
  id: number;
  name: string;
  cost: number;
  changeable: boolean;
  deleted: boolean;
}

interface OverheadTypeForm {
  name: string;
  cost: string;
  changeable: boolean;
}

interface Branch {
  id: number;
  name: string;
}

const emptyForm = (): OverheadTypeForm => ({ name: "", cost: "", changeable: true });

export default function OverheadTypesPage() {
  const { institution } = useInstitution();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [items, setItems] = useState<OverheadType[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<OverheadType | null>(null);
  const [form, setForm] = useState<OverheadTypeForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<OverheadType | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setBranchesLoading(true);
    setSelectedBranch("");
    setItems([]);
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Branch[]) => {
        setBranches(data);
        if (data.length > 0) setSelectedBranch(String(data[0].id));
      })
      .catch(() => toast.error("Filiallarni yuklashda xatolik"))
      .finally(() => setBranchesLoading(false));
  }, [institution]);

  const load = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const paramKey = institution === "gennis" ? "location_id" : "branch_id";
      const res = await apiFetch(`/overhead-types/${institution}?${paramKey}=${selectedBranch}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, institution]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialog(true);
  };

  const openEdit = (item: OverheadType) => {
    setEditing(item);
    setForm({ name: item.name, cost: String(item.cost), changeable: item.changeable });
    setDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res: Response;
      if (editing) {
        const copySlug = institution === "gennis" ? "gennis-copies" : "turon-copies";
        const body = { cost: Number(form.cost) || 0, changeable: form.changeable };
        res = await apiFetch(`/overhead-types/${copySlug}/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        if (!form.name.trim()) { toast.error("Nomi majburiy"); setSaving(false); return; }
        const paramKey = institution === "gennis" ? "location_id" : "branch_id";
        const body = {
          name: form.name.trim(),
          cost: Number(form.cost) || 0,
          changeable: form.changeable,
          ...(selectedBranch && { [paramKey]: Number(selectedBranch) }),
        };
        res = await apiFetch(`/overhead-types/${institution}`, { method: "POST", body: JSON.stringify(body) });
      }
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editing ? "Yangilandi" : "Yaratildi");
      setDialog(false);
      load();
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const copySlug = institution === "gennis" ? "gennis-copies" : "turon-copies";
      const res = await apiFetch(`/overhead-types/${copySlug}/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = items.filter((i) => !i.deleted).length;
  const totalCost = items.filter((i) => !i.deleted).reduce((s, i) => s + i.cost, 0);

  const branchLabel = institution === "gennis" ? "Lokatsiya" : "Filial";

  return (
    <DashboardLayout
      title="Xarajat Turlari"
      headerExtra={
        <div className="flex items-center gap-2">
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            disabled={branchesLoading || branches.length === 0}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              {branchesLoading
                ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Yuklanmoqda</span>
                : <SelectValue placeholder={branchLabel} />
              }
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate} disabled={!selectedBranch}>
            <Plus className="h-4 w-4 mr-1" /> Qo'shish
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Jami faol turlar</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Umumiy xarajat narxi</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)} UZS</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Xarajat turlari ro'yxati</CardTitle>
          </CardHeader>
          <div className="rounded-b-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Nomi</TableHead>
                  <TableHead className="text-right">Narxi</TableHead>
                  <TableHead className="text-center">O'zgartiriladi</TableHead>
                  <TableHead className="text-center">Holat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {selectedBranch ? "Ma'lumot yo'q" : `${branchLabel} tanlang`}
                    </TableCell>
                  </TableRow>
                ) : items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(item)}
                  >
                    <TableCell className="text-muted-foreground text-sm">{item.id}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.cost)} UZS</TableCell>
                    <TableCell className="text-center">
                      {item.changeable
                        ? <Badge variant="secondary" className="text-xs">Ha</Badge>
                        : <Badge variant="outline" className="text-xs text-muted-foreground">Yo'q</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {item.deleted
                        ? <Badge variant="destructive" className="text-xs">O'chirilgan</Badge>
                        : <Badge className="text-xs bg-green-500/15 text-green-700 hover:bg-green-500/20 border-0">Faol</Badge>
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button> */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Xarajat turini tahrirlash" : "Yangi xarajat turi"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div>
                <Label>Nomi <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Masalan: Arenda"
                />
              </div>
            )}
            <div>
              <Label>Narxi (UZS)</Label>
              <Input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
                placeholder="0"
                disabled={form.changeable}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="changeable"
                checked={form.changeable}
                onCheckedChange={(v) => setForm((p) => ({ ...p, changeable: !!v }))}
              />
              <Label htmlFor="changeable" className="cursor-pointer font-normal">
                O'zgartiriladi (changeable)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>
              Bekor
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              "<strong>{deleteTarget?.name}</strong>" xarajat turini o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Bekor
            </AlertDialogCancel>
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
    </DashboardLayout>
  );
}

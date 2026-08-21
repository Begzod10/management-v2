import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Phone, Mail, Building2, Briefcase, Calendar, Clock } from "lucide-react";
import type { StaffMember } from "@/data/staffData";
import type { Branch } from "@/data/mockData";
import { departments } from "@/data/staffData";
import { useMemo } from "react";

interface Props {
  member: StaffMember | null;
  onClose: () => void;
  branches: Branch[];
  onEdit: (m: StaffMember) => void;
}

export function StaffDetailSheet({ member, onClose, branches, onEdit }: Props) {
  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((b) => { map[b.id] = b.name.split(" — ")[1] || b.name; });
    return map;
  }, [branches]);

  if (!member) return null;

  const dept = departments.find((d) => d.id === member.departmentId);
  const initials = member.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const isActive = member.status === "active";

  return (
    <Sheet open={!!member} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-0">
          <SheetTitle className="sr-only">{member.fullName}</SheetTitle>
          <SheetDescription className="sr-only">Xodim tafsilotlari</SheetDescription>
        </SheetHeader>

        <div className="flex items-start gap-4 mt-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground">{member.fullName}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="secondary" className="text-xs">{member.role}</Badge>
              <Badge variant="outline" className="text-xs">{dept?.name}</Badge>
              <Badge className={`text-xs border-0 ${isActive ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" : "bg-destructive/15 text-destructive"}`}>
                {isActive ? "Faol" : "Nofaol"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit(member)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Tahrirlash
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-3">
          <InfoRow icon={Phone} label="Telefon" value={member.phone} mono />
          <InfoRow icon={Mail} label="Email" value={member.email} />
          <InfoRow icon={Building2} label="Bo'lim" value={dept?.name ?? "—"} />
          <InfoRow icon={Briefcase} label="Lavozim" value={member.role} />
        </div>

        <Separator className="my-4" />

        <div>
          <p className="text-sm font-medium text-foreground mb-2">Filiallarga kirish</p>
          {member.accessLevel === "all" ? (
            <Badge className="text-xs bg-primary/10 text-primary border-0">Barcha filiallar</Badge>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {member.branchIds.map((bid) => (
                <Badge key={bid} variant="outline" className="text-xs">{branchMap[bid] ?? bid}</Badge>
              ))}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <div className="grid gap-3">
          <InfoRow icon={Calendar} label="Yaratilgan sana" value={member.createdAt} />
          <InfoRow icon={Clock} label="Oxirgi kirish" value={member.lastLogin} />
        </div>

        {member.notes && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Izohlar</p>
              <p className="text-sm text-muted-foreground">{member.notes}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

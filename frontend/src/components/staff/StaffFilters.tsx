import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Department } from "@/data/staffData";
import type { Branch } from "@/data/mockData";

interface Props {
  departmentFilter: string;
  setDepartmentFilter: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  branchFilter: string;
  setBranchFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  departments: Department[];
  roles: string[];
  branches: Branch[];
}

export function StaffFilters({
  departmentFilter, setDepartmentFilter,
  roleFilter, setRoleFilter,
  branchFilter, setBranchFilter,
  statusFilter, setStatusFilter,
  departments, roles, branches,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Bo'lim" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barcha bo'limlar</SelectItem>
          {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Lavozim" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barcha lavozimlar</SelectItem>
          {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={branchFilter} onValueChange={setBranchFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filial" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barcha filiallar</SelectItem>
          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Holat" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barcha holatlar</SelectItem>
          <SelectItem value="active">Faol</SelectItem>
          <SelectItem value="inactive">Nofaol</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, UserX, Eye } from "lucide-react";
import type { StaffMember } from "@/data/staffData";
import type { Branch } from "@/data/mockData";
import { departments } from "@/data/staffData";

interface Props {
  data: StaffMember[];
  branches: Branch[];
  onView: (m: StaffMember) => void;
  onEdit: (m: StaffMember) => void;
}

export function StaffTable({ data, branches, onView, onEdit }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((b) => { map[b.id] = b.name.split(" — ")[1] || b.name; });
    return map;
  }, [branches]);

  const deptMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => { map[d.id] = d.name; });
    return map;
  }, []);

  const columns: ColumnDef<StaffMember>[] = useMemo(
    () => [
      {
        accessorKey: "fullName",
        header: "To'liq ism",
        cell: ({ row }) => (
          <button
            className="font-medium text-foreground hover:text-primary transition-colors text-left"
            onClick={() => onView(row.original)}
          >
            {row.original.fullName}
          </button>
        ),
      },
      {
        accessorKey: "role",
        header: "Lavozim",
        cell: ({ row }) => <Badge variant="secondary" className="text-xs">{row.original.role}</Badge>,
      },
      {
        accessorKey: "departmentId",
        header: "Bo'lim",
        cell: ({ row }) => <Badge variant="outline" className="text-xs">{deptMap[row.original.departmentId]}</Badge>,
      },
      {
        id: "branches",
        header: "Kirish",
        cell: ({ row }) => {
          const s = row.original;
          if (s.accessLevel === "all") return <Badge className="text-xs bg-primary/10 text-primary border-0">Barcha filiallar</Badge>;
          return (
            <div className="flex flex-wrap gap-1">
              {s.branchIds.map((bid) => (
                <Badge key={bid} variant="outline" className="text-xs">{branchMap[bid] ?? bid}</Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Telefon",
        cell: ({ row }) => <span className="text-sm text-muted-foreground font-mono">{row.original.phone}</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.email}</span>,
      },
      {
        accessorKey: "status",
        header: "Holat",
        cell: ({ row }) => {
          const active = row.original.status === "active";
          return (
            <Badge className={`text-xs border-0 ${active ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" : "bg-destructive/15 text-destructive"}`}>
              {active ? "Faol" : "Nofaol"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(row.original)}>
                <Eye className="h-4 w-4 mr-2" /> Ko'rish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="h-4 w-4 mr-2" /> Tahrirlash
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <UserX className="h-4 w-4 mr-2" /> O'chirish
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [branchMap, deptMap, onView, onEdit],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Xodimlar topilmadi
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

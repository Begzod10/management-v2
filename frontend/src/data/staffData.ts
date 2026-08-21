import { Institution } from "@/contexts/InstitutionContext";
import { getInstitutionBranches } from "@/data/mockData";

export type StaffStatus = "active" | "inactive";
export type AccessLevel = "all" | "specific";

export interface Department {
  id: string;
  name: string;
  headRole: string;
}

export const departments: Department[] = [
  { id: "it", name: "IT", headRole: "IT bo'yicha boshlig'i" },
  { id: "academic", name: "Akademik", headRole: "Ta'lim bo'yicha boshlig'i" },
  { id: "accounting", name: "Buxgalteriya", headRole: "Bosh buxgalter" },
  { id: "hr", name: "HR", headRole: "Kadrlar bo'yicha boshlig'i" },
  { id: "marketing", name: "Marketing", headRole: "Marketing bo'yicha boshlig'i" },
  { id: "operations", name: "Operatsiyalar", headRole: "Operatsion direktor" },
  { id: "admin", name: "Ma'muriyat", headRole: "Administrator" },
];

export function getRoleSuggestions(departmentId: string): string[] {
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return [];
  const suffixes: Record<string, string[]> = {
    it: [dept.headRole, "IT mutaxassisi", "Tizim administratori"],
    academic: [dept.headRole, "Metodist", "Koordinator"],
    accounting: [dept.headRole, "Buxgalter", "Kassir"],
    hr: [dept.headRole, "HR-menejer", "Rekruter"],
    marketing: [dept.headRole, "Marketolog", "SMM-menejer"],
    operations: [dept.headRole, "Operatsiyalar menejeri", "Logist"],
    admin: [dept.headRole, "Kotib", "Ofis menejeri"],
  };
  return suffixes[departmentId] ?? [dept.headRole];
}

export interface StaffMember {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  departmentId: string;
  role: string;
  accessLevel: AccessLevel;
  branchIds: string[];
  status: StaffStatus;
  notes: string;
  createdAt: string;
  lastLogin: string;
  institution: Institution;
}

export function getStaffMembers(institution: Institution): StaffMember[] {
  return staffMembers.filter((s) => s.institution === institution);
}

const staffMembers: StaffMember[] = [
  {
    id: "s1", fullName: "Алишер Каримов", phone: "+998 90 123 45 67", email: "karimov@gennis.uz",
    departmentId: "it", role: "IT bo'yicha boshlig'i", accessLevel: "all", branchIds: [],
    status: "active", notes: "Barcha IT infratuzilmasi uchun mas'ul", createdAt: "2024-06-01", lastLogin: "2026-03-07", institution: "gennis",
  },
  {
    id: "s2", fullName: "Саида Умарова", phone: "+998 91 234 56 78", email: "umarova@gennis.uz",
    departmentId: "academic", role: "Ta'lim bo'yicha boshlig'i", accessLevel: "all", branchIds: [],
    status: "active", notes: "", createdAt: "2024-01-15", lastLogin: "2026-03-06", institution: "gennis",
  },
  {
    id: "s3", fullName: "Мурод Тошматов", phone: "+998 93 345 67 89", email: "toshmatov@gennis.uz",
    departmentId: "accounting", role: "Bosh buxgalter", accessLevel: "all", branchIds: [],
    status: "active", notes: "", createdAt: "2024-03-10", lastLogin: "2026-03-07", institution: "gennis",
  },
  {
    id: "s4", fullName: "Дилноза Рустамова", phone: "+998 94 456 78 90", email: "rustamova@gennis.uz",
    departmentId: "hr", role: "HR-menejer", accessLevel: "specific", branchIds: ["g-chilonzor", "g-yunusobod"],
    status: "active", notes: "", createdAt: "2025-02-20", lastLogin: "2026-03-05", institution: "gennis",
  },
  {
    id: "s5", fullName: "Рустам Абдуллаев", phone: "+998 95 567 89 01", email: "abdullayev@gennis.uz",
    departmentId: "operations", role: "Operatsiyalar menejeri", accessLevel: "specific", branchIds: ["g-sergeli"],
    status: "active", notes: "", createdAt: "2025-06-01", lastLogin: "2026-03-04", institution: "gennis",
  },
  {
    id: "s6", fullName: "Лола Каримова", phone: "+998 90 678 90 12", email: "l.karimova@gennis.uz",
    departmentId: "marketing", role: "Marketing bo'yicha boshlig'i", accessLevel: "all", branchIds: [],
    status: "active", notes: "", createdAt: "2024-09-01", lastLogin: "2026-03-07", institution: "gennis",
  },
  {
    id: "s7", fullName: "Бахром Исмоилов", phone: "+998 97 111 22 33", email: "ismoilov@gennis.uz",
    departmentId: "it", role: "IT mutaxassisi", accessLevel: "specific", branchIds: ["g-chilonzor"],
    status: "inactive", notes: "Ta'tilda", createdAt: "2025-01-10", lastLogin: "2026-02-15", institution: "gennis",
  },
  // Turon staff
  {
    id: "s8", fullName: "Жамшид Холматов", phone: "+998 90 222 33 44", email: "kholmatov@turon.uz",
    departmentId: "operations", role: "Operatsion direktor", accessLevel: "all", branchIds: [],
    status: "active", notes: "", createdAt: "2024-08-01", lastLogin: "2026-03-07", institution: "turon",
  },
  {
    id: "s9", fullName: "Нигора Азимова", phone: "+998 91 333 44 55", email: "azimova@turon.uz",
    departmentId: "academic", role: "Ta'lim bo'yicha boshlig'i", accessLevel: "all", branchIds: [],
    status: "active", notes: "", createdAt: "2024-05-15", lastLogin: "2026-03-06", institution: "turon",
  },
  {
    id: "s10", fullName: "Фарход Назаров", phone: "+998 93 444 55 66", email: "nazarov@turon.uz",
    departmentId: "admin", role: "Administrator", accessLevel: "specific", branchIds: ["t-mirzo"],
    status: "active", notes: "", createdAt: "2025-03-01", lastLogin: "2026-03-07", institution: "turon",
  },
  {
    id: "s11", fullName: "Гулнора Шарипова", phone: "+998 94 555 66 77", email: "sharipova@turon.uz",
    departmentId: "accounting", role: "Buxgalter", accessLevel: "specific", branchIds: ["t-yakkasaroy"],
    status: "inactive", notes: "Tug'ruq ta'tili", createdAt: "2024-11-01", lastLogin: "2026-01-20", institution: "turon",
  },
];

import { Institution } from "@/contexts/InstitutionContext";

export interface Branch {
  id: string;
  name: string;
  address: string;
  students: number;
  teachers: number;
  monthlyRevenue: number;
}

export interface BalanceSheet {
  bank: number;
  cash: number;
  obligations: {
    teacherSalaries: number;
    staffSalaries: number;
    other: number;
  };
}

export interface IncomeStatement {
  income: {
    tuition: number;
    other: number;
  };
  expenses: {
    salaries: { teachers: number; staff: number };
    overhead: { rent: number; marketing: number; other: number };
    utilities: { electricity: number; water: number; internet: number; other: number };
  };
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface AttendanceTrend {
  date: string;
  present: number;
  absent: number;
}

export interface UpcomingLesson {
  id: string;
  time: string;
  subject: string;
  teacher: string;
  group: string;
}

export interface RecentPayment {
  id: string;
  student: string;
  amount: number;
  date: string;
  status: "paid" | "partial" | "pending";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "not_started" | "in_progress" | "done" | "overdue" | "blocked" | "completed" | "approved" | "declined" | "recheck";
  priority: "low" | "medium" | "high";
  department: "admin" | "academic" | "finance" | "hr";
  executor: string;
  executorId?: number;
  executorAvatar?: string;
  reviewer: string;
  reviewerId?: number;
  reviewerAvatar?: string;
  creator: string;
  creatorId?: number;
  creatorAvatar?: string;
  deadline: string;
  createdAt: string;
  kpiWeight: number;
  recurring: boolean;
  recurringType?: "daily" | "weekly" | "monthly";
  repeatEvery?: number;
  tags: string[];
  subtasks: { id: string; title: string; done: boolean }[];
  comments: { id: string; user: string; text: string; timestamp: string }[];
  attachments: { id: string; name: string; size: string; type: string; date: string }[];
  proofs: { id: string; name: string; size: string; date: string; uploader: string }[];
  gennis_executor_id?: number;
  turon_executor_id?: number;
  gennis_reviewer_id?: number;
  turon_reviewer_id?: number;
  system?: "gennis" | "turon";
  project_id?: number;
}

// Branch data per institution
const branchesData: Record<Institution, Branch[]> = {
  gennis: [
    { id: "g-chilonzor", name: "Gennis — Chilonzor", address: "Chilonzor, 9-kvartal", students: 128, teachers: 11, monthlyRevenue: 72000000 },
    { id: "g-yunusobod", name: "Gennis — Yunusobod", address: "Yunusobod, Bog'ishamol", students: 105, teachers: 9, monthlyRevenue: 61500000 },
    { id: "g-sergeli", name: "Gennis — Sergeli", address: "Sergeli, 7a mavze", students: 109, teachers: 8, monthlyRevenue: 54000000 },
  ],
  turon: [
    { id: "t-mirzo", name: "Turon — Mirzo Ulug'bek", address: "Mirzo Ulug'bek, Buyuk Ipak Yo'li", students: 95, teachers: 8, monthlyRevenue: 110000000 },
    { id: "t-yakkasaroy", name: "Turon — Yakkasaroy", address: "Yakkasaroy, Shota Rustaveli", students: 120, teachers: 11, monthlyRevenue: 135000000 },
  ],
};

// Per-branch financial data
const branchBalanceSheets: Record<string, BalanceSheet> = {
  "g-chilonzor": { bank: 18000000, cash: 5000000, obligations: { teacherSalaries: 7200000, staffSalaries: 3400000, other: 1200000 } },
  "g-yunusobod": { bank: 15000000, cash: 4200000, obligations: { teacherSalaries: 5900000, staffSalaries: 2800000, other: 1100000 } },
  "g-sergeli": { bank: 12000000, cash: 3300000, obligations: { teacherSalaries: 4900000, staffSalaries: 2300000, other: 900000 } },
  "t-mirzo": { bank: 28000000, cash: 3800000, obligations: { teacherSalaries: 9500000, staffSalaries: 4800000, other: 2000000 } },
  "t-yakkasaroy": { bank: 34000000, cash: 4900000, obligations: { teacherSalaries: 12500000, staffSalaries: 6200000, other: 2500000 } },
};

const branchIncomeStatements: Record<string, IncomeStatement> = {
  "g-chilonzor": {
    income: { tuition: 64000000, other: 8000000 },
    expenses: { salaries: { teachers: 19200000, staff: 8800000 }, overhead: { rent: 6000000, marketing: 2000000, other: 1400000 }, utilities: { electricity: 1100000, water: 300000, internet: 500000, other: 200000 } },
  },
  "g-yunusobod": {
    income: { tuition: 52500000, other: 7500000 },
    expenses: { salaries: { teachers: 15200000, staff: 7000000 }, overhead: { rent: 5000000, marketing: 1600000, other: 1100000 }, utilities: { electricity: 900000, water: 260000, internet: 400000, other: 150000 } },
  },
  "g-sergeli": {
    income: { tuition: 48500000, other: 7000000 },
    expenses: { salaries: { teachers: 13600000, staff: 6200000 }, overhead: { rent: 4000000, marketing: 1400000, other: 1000000 }, utilities: { electricity: 800000, water: 240000, internet: 300000, other: 150000 } },
  },
  "t-mirzo": {
    income: { tuition: 95000000, other: 11000000 },
    expenses: { salaries: { teachers: 25000000, staff: 12000000 }, overhead: { rent: 11000000, marketing: 3500000, other: 2200000 }, utilities: { electricity: 1800000, water: 500000, internet: 650000, other: 350000 } },
  },
  "t-yakkasaroy": {
    income: { tuition: 125000000, other: 14000000 },
    expenses: { salaries: { teachers: 33000000, staff: 16000000 }, overhead: { rent: 14000000, marketing: 4500000, other: 2800000 }, utilities: { electricity: 2400000, water: 700000, internet: 850000, other: 450000 } },
  },
};

// Month multiplier to simulate different months
function monthMultiplier(month: number): number {
  const multipliers = [0.85, 0.88, 0.95, 1.0, 1.02, 0.7, 0.3, 0.4, 0.92, 1.05, 1.0, 0.9];
  return multipliers[month] ?? 1.0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMonth<T extends Record<string, any>>(obj: T, mult: number): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "number") {
      result[key] = Math.round(val * mult);
    } else if (typeof val === "object" && val !== null) {
      result[key] = applyMonth(val, mult);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function getInstitutionBranches(inst: Institution): Branch[] {
  return branchesData[inst];
}

export function getBalanceSheet(inst: Institution, branchId?: string | null, month?: number): BalanceSheet {
  const m = month !== undefined ? monthMultiplier(month) : 1.0;

  if (branchId) {
    const bs = branchBalanceSheets[branchId];
    return bs ? applyMonth(bs, m) : { bank: 0, cash: 0, obligations: { teacherSalaries: 0, staffSalaries: 0, other: 0 } };
  }

  // Aggregate all branches
  const branches = branchesData[inst];
  const agg: BalanceSheet = { bank: 0, cash: 0, obligations: { teacherSalaries: 0, staffSalaries: 0, other: 0 } };
  for (const b of branches) {
    const bs = branchBalanceSheets[b.id];
    if (bs) {
      agg.bank += bs.bank;
      agg.cash += bs.cash;
      agg.obligations.teacherSalaries += bs.obligations.teacherSalaries;
      agg.obligations.staffSalaries += bs.obligations.staffSalaries;
      agg.obligations.other += bs.obligations.other;
    }
  }
  return applyMonth(agg, m);
}

export function getIncomeStatement(inst: Institution, branchId?: string | null, month?: number): IncomeStatement {
  const m = month !== undefined ? monthMultiplier(month) : 1.0;

  if (branchId) {
    const is = branchIncomeStatements[branchId];
    return is
      ? applyMonth(is, m)
      : { income: { tuition: 0, other: 0 }, expenses: { salaries: { teachers: 0, staff: 0 }, overhead: { rent: 0, marketing: 0, other: 0 }, utilities: { electricity: 0, water: 0, internet: 0, other: 0 } } };
  }

  const branches = branchesData[inst];
  const agg: IncomeStatement = {
    income: { tuition: 0, other: 0 },
    expenses: { salaries: { teachers: 0, staff: 0 }, overhead: { rent: 0, marketing: 0, other: 0 }, utilities: { electricity: 0, water: 0, internet: 0, other: 0 } },
  };
  for (const b of branches) {
    const is = branchIncomeStatements[b.id];
    if (is) {
      agg.income.tuition += is.income.tuition;
      agg.income.other += is.income.other;
      agg.expenses.salaries.teachers += is.expenses.salaries.teachers;
      agg.expenses.salaries.staff += is.expenses.salaries.staff;
      agg.expenses.overhead.rent += is.expenses.overhead.rent;
      agg.expenses.overhead.marketing += is.expenses.overhead.marketing;
      agg.expenses.overhead.other += is.expenses.overhead.other;
      agg.expenses.utilities.electricity += is.expenses.utilities.electricity;
      agg.expenses.utilities.water += is.expenses.utilities.water;
      agg.expenses.utilities.internet += is.expenses.utilities.internet;
      agg.expenses.utilities.other += is.expenses.utilities.other;
    }
  }
  return applyMonth(agg, m);
}

export function getMonthlyRevenue(inst: Institution, branchId?: string | null): MonthlyRevenue[] {
  const branches = branchesData[inst];
  const baseTotals = branchId
    ? [branchBalanceSheets[branchId]?.bank ?? 50000000]
    : branches.map((b) => b.monthlyRevenue);
  const baseRevenue = baseTotals.reduce((a, b) => a + b, 0);

  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const mults = [0.85, 0.92, 0.95, 0.7, 1.0, 1.05];
  return months.map((month, i) => ({
    month,
    revenue: Math.round(baseRevenue * mults[i]),
  }));
}

export function getAttendanceTrend(branchId?: string | null): AttendanceTrend[] {
  const scale = branchId ? 0.4 : 1;
  return [
    { date: "Mon", present: Math.round(285 * scale), absent: Math.round(15 * scale) },
    { date: "Tue", present: Math.round(290 * scale), absent: Math.round(10 * scale) },
    { date: "Wed", present: Math.round(278 * scale), absent: Math.round(22 * scale) },
    { date: "Thu", present: Math.round(295 * scale), absent: Math.round(5 * scale) },
    { date: "Fri", present: Math.round(260 * scale), absent: Math.round(40 * scale) },
  ];
}

export function getUpcomingLessons(): UpcomingLesson[] {
  return [
    { id: "1", time: "09:00", subject: "Mathematics", teacher: "A. Karimov", group: "Group A-1" },
    { id: "2", time: "10:30", subject: "English", teacher: "S. Umarova", group: "Group B-2" },
    { id: "3", time: "12:00", subject: "Physics", teacher: "D. Rustamov", group: "Group A-3" },
    { id: "4", time: "14:00", subject: "Chemistry", teacher: "N. Azimova", group: "Group C-1" },
  ];
}

export function getRecentPayments(): RecentPayment[] {
  return [
    { id: "1", student: "Alisher Navoiy", amount: 1500000, date: "2026-03-07", status: "paid" },
    { id: "2", student: "Bobur Mirzo", amount: 1500000, date: "2026-03-06", status: "paid" },
    { id: "3", student: "Charos Begim", amount: 750000, date: "2026-03-06", status: "partial" },
    { id: "4", student: "Davron Ergashev", amount: 0, date: "2026-03-05", status: "pending" },
    { id: "5", student: "Elnora Yusupova", amount: 1500000, date: "2026-03-05", status: "paid" },
  ];
}

export function getTasks(): Task[] {
  return [
    {
      id: "1",
      title: "Prepare Q1 financial report",
      description: "Compile all financial data for Q1 2026 including revenue, expenses, and profit margins for both institutions.",
      status: "in_progress",
      priority: "high",
      department: "finance",
      executor: "M. Toshmatov",
      reviewer: "Admin",
      creator: "Admin",
      deadline: "2026-03-15",
      createdAt: "2026-03-01T09:00:00",
      kpiWeight: 15,
      recurring: false,
      tags: ["finance", "report"],
      subtasks: [
        { id: "s1", title: "Collect revenue data", done: true },
        { id: "s2", title: "Calculate expenses", done: true },
        { id: "s3", title: "Create summary charts", done: false },
        { id: "s4", title: "Submit for review", done: false },
      ],
      comments: [
        { id: "c1", user: "Admin", text: "Please prioritize this task", timestamp: "2026-03-01T09:30:00" },
      ],
      attachments: [],
      proofs: [],
    },
    {
      id: "2",
      title: "Update student attendance records",
      description: "Review and update all attendance records for February 2026.",
      status: "not_started",
      priority: "medium",
      department: "academic",
      executor: "S. Umarova",
      reviewer: "Admin",
      creator: "Admin",
      deadline: "2026-03-10",
      createdAt: "2026-03-02T10:00:00",
      kpiWeight: 8,
      recurring: true,
      recurringType: "monthly",
      repeatEvery: 1,
      tags: ["academic", "attendance"],
      subtasks: [],
      comments: [],
      attachments: [],
      proofs: [],
    },
    {
      id: "3",
      title: "Fix classroom projector in Room 204",
      description: "The projector in Room 204 is not displaying correctly. Needs technical inspection.",
      status: "overdue",
      priority: "high",
      department: "admin",
      executor: "R. Abdullayev",
      reviewer: "Admin",
      creator: "D. Rustamov",
      deadline: "2026-03-03",
      createdAt: "2026-02-28T14:00:00",
      kpiWeight: 5,
      recurring: false,
      tags: ["maintenance", "urgent"],
      subtasks: [
        { id: "s5", title: "Inspect projector", done: true },
        { id: "s6", title: "Order replacement parts", done: false },
      ],
      comments: [
        { id: "c2", user: "D. Rustamov", text: "Students are complaining about this", timestamp: "2026-03-01T11:00:00" },
        { id: "c3", user: "R. Abdullayev", text: "Will check today", timestamp: "2026-03-01T14:00:00" },
      ],
      attachments: [],
      proofs: [],
    },
    {
      id: "4",
      title: "Plan spring parent-teacher meeting",
      description: "Organize the spring parent-teacher conference for all groups.",
      status: "not_started",
      priority: "medium",
      department: "academic",
      executor: "N. Azimova",
      reviewer: "Admin",
      creator: "Admin",
      deadline: "2026-03-20",
      createdAt: "2026-03-05T08:00:00",
      kpiWeight: 10,
      recurring: false,
      tags: ["event", "parents"],
      subtasks: [],
      comments: [],
      attachments: [],
      proofs: [],
    },
    {
      id: "5",
      title: "Process teacher salary payments",
      description: "Calculate and process all teacher salaries for March 2026.",
      status: "not_started",
      priority: "high",
      department: "finance",
      executor: "M. Toshmatov",
      reviewer: "Admin",
      creator: "Admin",
      deadline: "2026-03-25",
      createdAt: "2026-03-05T09:00:00",
      kpiWeight: 20,
      recurring: true,
      recurringType: "monthly",
      repeatEvery: 1,
      tags: ["finance", "salary"],
      subtasks: [],
      comments: [],
      attachments: [],
      proofs: [],
    },
    {
      id: "6",
      title: "Review marketing campaign results",
      description: "Analyze the February social media and outdoor marketing campaign effectiveness.",
      status: "done",
      priority: "low",
      department: "admin",
      executor: "L. Karimova",
      reviewer: "Admin",
      creator: "Admin",
      deadline: "2026-03-07",
      createdAt: "2026-03-03T11:00:00",
      kpiWeight: 5,
      recurring: false,
      tags: ["marketing", "review"],
      subtasks: [
        { id: "s7", title: "Collect campaign metrics", done: true },
        { id: "s8", title: "Create comparison chart", done: true },
        { id: "s9", title: "Write summary report", done: true },
      ],
      comments: [
        { id: "c4", user: "Admin", text: "Good work on this!", timestamp: "2026-03-07T10:00:00" },
      ],
      attachments: [],
      proofs: [],
    },
  ];
}

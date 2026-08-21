import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type AccountantSystem = "gennis" | "turon";

export type AccountantScope =
  | { system: "gennis"; location_id: number }
  | { system: "turon"; branch_id: number };

export interface Pagination {
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface AccountantBranch {
  id: number;
  name: string;
}

export interface AccountantDashboardResponse {
  system: AccountantSystem;
  scope_id: number;
  today: string;
  today_payments: {
    value: number;
    yesterday_value: number;
    delta_vs_yesterday_pct: number | null;
  };
  monthly_income: {
    value: number;
    month: number;
    year: number;
    month_label: string;
  };
  debt: {
    value: number;
    open_count: number;
  };
  today_expenses: {
    value: number;
    salaries: number;
    overheads: number;
  };
  trend: Array<{
    month: number;
    year: number;
    label: string;
    income: number;
  }>;
  recent_payments: Array<{
    id: number;
    student_name: string;
    amount: number;
    channel: string | null;
    date: string;
    type: string;
    status: string;
  }>;
}

export type AccountantStudentStatus = "all" | "active" | "partial" | "debtor";

export interface AccountantStudentsFilters {
  month?: number;
  year?: number;
  search?: string;
  status?: AccountantStudentStatus;
  offset?: number;
  limit?: number;
}

export interface AccountantStudentsResponse {
  system: AccountantSystem;
  scope_id: number;
  month: number;
  year: number;
  students: Array<{
    id: number;
    name: string;
    phone: string | null;
    class_label: string | null;
    monthly: number;
    payment: number;
    remaining_debt: number;
    discount: number;
    discount_pct: number;
    status: Exclude<AccountantStudentStatus, "all">;
  }>;
  totals: {
    count: number;
    monthly: number;
    payment: number;
    remaining_debt: number;
    discount: number;
    active: number;
    partial: number;
    debtor: number;
  };
  pagination: Pagination;
}

export interface AccountantPaymentsFilters {
  month?: number;
  year?: number;
  search?: string;
  channel?: string;
  type?: "payment" | "discount";
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}

export interface AccountantPaymentsResponse {
  system: AccountantSystem;
  scope_id: number;
  month: number;
  year: number;
  month_total: number;
  totals_by_channel: Array<{
    channel: string;
    label: string;
    value: number;
    percent: number;
  }>;
  trend: Array<{
    month: number;
    year: number;
    label: string;
    revenue: number;
    expense: number;
  }>;
  items: Array<{
    id: number;
    code: string;
    student_name: string;
    amount: number;
    channel: string | null;
    channel_label: string | null;
    date: string;
    date_label: string;
    type: string;
    status: string;
  }>;
  pagination: Pagination;
}

export interface AccountantOverheadsFilters {
  month?: number;
  year?: number;
  from?: string;
  to?: string;
  search?: string;
  overhead_type_id?: number;
  payment_type_id?: number;
  offset?: number;
  limit?: number;
}

export interface AccountantOverheadsResponse {
  system: AccountantSystem;
  scope_id: number;
  month: number;
  year: number;
  chart: Array<{
    month: number;
    year: number;
    label: string;
    revenue: number;
    expense: number;
  }>;
  overheads: Array<{
    id: number;
    name: string;
    category: string | null;
    category_id: number | null;
    amount: number;
    branch_name: string | null;
    branch_id: number | null;
    date: string;
    payment_type: string | null;
    payment_type_id: number | null;
  }>;
  totals: {
    count: number;
    amount: number;
    by_payment_type: Array<{
      payment_type_id: number | null;
      payment_type: string | null;
      amount: number;
    }>;
    by_category: Array<{
      category_id: number | null;
      category: string | null;
      amount: number;
    }>;
  };
  pagination: Pagination;
}

export type AccountantSalaryRole = "all" | "teacher" | "assistent" | "staff";
export type AccountantSalaryStatus = "all" | "pending" | "partial" | "paid";

export interface AccountantSalariesFilters {
  month?: number;
  year?: number;
  from?: string;
  to?: string;
  search?: string;
  role?: AccountantSalaryRole;
  status?: AccountantSalaryStatus;
  offset?: number;
  limit?: number;
}

export interface AccountantSalariesResponse {
  system: AccountantSystem;
  scope_id: number;
  month: number;
  year: number;
  kpis: {
    accrued: number;
    bonus_total: number;
    bonus_employee_count: number;
    advance: number;
    remaining: number;
  };
  rows: Array<{
    id: number;
    employee_id: number;
    name: string;
    role: Exclude<AccountantSalaryRole, "all">;
    position: string | null;
    hours: number | null;
    rate_per_hour: number | null;
    base_salary: number;
    bonus: number;
    advance: number;
    total: number;
    remaining: number;
    status: Exclude<AccountantSalaryStatus, "all">;
  }>;
  pagination: Pagination;
}

export type AccountantDebtsTab = "students" | "given" | "taken";
export type AccountantLoanStatus = "all" | "active" | "settled" | "cancelled";

export interface AccountantDebtsFilters {
  tab: AccountantDebtsTab;
  month?: number;
  year?: number;
  status?: AccountantLoanStatus;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface AccountantStudentDebtsResponse {
  system: AccountantSystem;
  scope_id: number;
  tab: "students";
  month: number;
  year: number;
  rows: Array<{
    student_id: number;
    name: string;
    group_label: string | null;
    debt_amount: number;
    days_overdue: number;
    discount_status: "active" | "cancelled" | "none";
    discount_amount: number;
    last_payment_date: string | null;
    status: "overdue" | "pending";
  }>;
  totals: {
    count: number;
    debt_amount: number;
    overdue_count: number;
    pending_count: number;
  };
  pagination: Pagination;
}

export interface AccountantLoanDebtsResponse {
  system: AccountantSystem;
  scope_id: number;
  tab: "given" | "taken";
  rows: Array<{
    id: number;
    management_id: number | null;
    counterparty: string;
    counterparty_phone: string | null;
    direction: "out" | "in";
    principal_amount: number;
    issued_date: string;
    due_date: string | null;
    settled_date: string | null;
    days_overdue: number;
    reason: string | null;
    status: "active" | "overdue" | "settled" | "cancelled";
  }>;
  totals: {
    count: number;
    principal_total: number;
    active_total: number;
    settled_total: number;
    cancelled_total: number;
  };
  pagination: Pagination;
}

export type AccountantDebtsResponse = AccountantStudentDebtsResponse | AccountantLoanDebtsResponse;

type QueryValue = string | number | boolean | null | undefined;

function compactParams(params: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

export function scopeParams(scope: AccountantScope) {
  return scope.system === "gennis"
    ? { system: scope.system, location_id: scope.location_id }
    : { system: scope.system, branch_id: scope.branch_id };
}

export function makeAccountantScope(system: AccountantSystem, scopeId: number): AccountantScope {
  return system === "gennis"
    ? { system, location_id: scopeId }
    : { system, branch_id: scopeId };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) message = Array.isArray(data.detail) ? JSON.stringify(data.detail) : String(data.detail);
    } catch {
      // Keep the status-based message when the response body is not JSON.
    }
    throw new Error(message);
  }
  return res.json();
}

function accountantPath(endpoint: string, scope: AccountantScope, filters: Record<string, QueryValue> = {}) {
  const query = compactParams({ ...scopeParams(scope), ...filters });
  return `/accountant/${endpoint}${query ? `?${query}` : ""}`;
}

export function getAccountantBranches(system: AccountantSystem) {
  return getJson<AccountantBranch[]>(`/${system}/branches`);
}

export function getAccountantDashboard(scope: AccountantScope, filters: { date?: string; from?: string; to?: string } = {}) {
  return getJson<AccountantDashboardResponse>(accountantPath("dashboard", scope, filters));
}

export function getAccountantStudents(scope: AccountantScope, filters: AccountantStudentsFilters = {}) {
  return getJson<AccountantStudentsResponse>(accountantPath("students", scope, filters));
}

export function getAccountantPayments(scope: AccountantScope, filters: AccountantPaymentsFilters = {}) {
  return getJson<AccountantPaymentsResponse>(accountantPath("payments", scope, filters));
}

export function getAccountantOverheads(scope: AccountantScope, filters: AccountantOverheadsFilters = {}) {
  return getJson<AccountantOverheadsResponse>(accountantPath("overheads", scope, filters));
}

export function getAccountantSalaries(scope: AccountantScope, filters: AccountantSalariesFilters = {}) {
  return getJson<AccountantSalariesResponse>(accountantPath("salaries", scope, filters));
}

export function getAccountantDebts(scope: AccountantScope, filters: AccountantDebtsFilters) {
  return getJson<AccountantDebtsResponse>(accountantPath("debts", scope, filters));
}

export function useAccountantBranches(system: AccountantSystem) {
  return useQuery({
    queryKey: ["accountant", "branches", system],
    queryFn: () => getAccountantBranches(system),
    staleTime: 5 * 60_000,
  });
}

export function useAccountantDashboard(scope: AccountantScope | null, filters: { date?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ["accountant", "dashboard", scope, filters],
    queryFn: () => getAccountantDashboard(scope!, filters),
    enabled: !!scope,
    staleTime: 60_000,
  });
}

export function useAccountantStudents(scope: AccountantScope | null, filters: AccountantStudentsFilters = {}) {
  return useQuery({
    queryKey: ["accountant", "students", scope, filters],
    queryFn: () => getAccountantStudents(scope!, filters),
    enabled: !!scope,
    placeholderData: keepPreviousData,
  });
}

export function useAccountantPayments(scope: AccountantScope | null, filters: AccountantPaymentsFilters = {}) {
  return useQuery({
    queryKey: ["accountant", "payments", scope, filters],
    queryFn: () => getAccountantPayments(scope!, filters),
    enabled: !!scope,
    placeholderData: keepPreviousData,
  });
}

export function useAccountantOverheads(scope: AccountantScope | null, filters: AccountantOverheadsFilters = {}) {
  return useQuery({
    queryKey: ["accountant", "overheads", scope, filters],
    queryFn: () => getAccountantOverheads(scope!, filters),
    enabled: !!scope,
    placeholderData: keepPreviousData,
  });
}

export function useAccountantSalaries(scope: AccountantScope | null, filters: AccountantSalariesFilters = {}) {
  return useQuery({
    queryKey: ["accountant", "salaries", scope, filters],
    queryFn: () => getAccountantSalaries(scope!, filters),
    enabled: !!scope,
    placeholderData: keepPreviousData,
  });
}

export function useAccountantDebts(scope: AccountantScope | null, filters: AccountantDebtsFilters) {
  return useQuery({
    queryKey: ["accountant", "debts", scope, filters],
    queryFn: () => getAccountantDebts(scope!, filters),
    enabled: !!scope,
    placeholderData: keepPreviousData,
  });
}

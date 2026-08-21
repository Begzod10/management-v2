import { Task } from "@/data/mockData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function personName(val: any, fallbackId?: number): string {
  if (!val) return fallbackId ? String(fallbackId) : "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return `${val.name ?? ""} ${val.surname ?? ""}`.trim() || String(val.id ?? "");
  return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveTaskExecutorName(t: any): string {
  // Once a mission has been redirected, mission.executor is the ground truth —
  // redirect only rewires the internal executor and never touches the original
  // gennis/turon routing fields, so trusting them here would keep showing the
  // pre-redirect external person even after ownership moved to someone internal.
  if (!t.is_redirected) {
    if (t.gennis_executor_id && t.gennis_executor_name) {
      const loc = t.location_name ? ` (Gennis - ${t.location_name})` : " (Gennis)";
      return `${t.gennis_executor_name}${loc}`;
    }
    if (t.turon_executor_id && t.turon_executor_name) {
      const branch = t.branch_name ? ` (Turon - ${t.branch_name})` : " (Turon)";
      return `${t.turon_executor_name}${branch}`;
    }
  }
  return personName(t.executor, t.executor?.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveTaskExecutorId(t: any): number | undefined {
  if (!t.is_redirected) {
    if (t.gennis_executor_id) return t.gennis_executor_id;
    if (t.turon_executor_id) return t.turon_executor_id;
  }
  return t.executor?.id ?? t.executor_id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApiTask(t: any): Task {
  return {
    id: String(t.id),
    title: t.title ?? "",
    description: t.description ?? "",
    status: t.status ?? "not_started",
    priority: t.priority ?? "medium",
    department: t.category ?? t.department ?? "admin",
    executor: resolveTaskExecutorName(t),
    executorId: resolveTaskExecutorId(t),
    reviewer: personName(t.reviewer, t.reviewer_id),
    reviewerId: t.reviewer?.id ?? t.reviewer_id,
    creator: personName(t.creator, t.creator_id),
    creatorId: t.creator?.id ?? t.creator_id,
    deadline: t.deadline ?? "",
    createdAt: t.created_at ?? t.createdAt ?? "",
    kpiWeight: t.kpi_weight ?? t.kpiWeight ?? 0,
    recurring: t.is_recurring ?? t.recurring ?? false,
    recurringType: t.recurring_type ?? t.recurringType,
    repeatEvery: t.repeat_every ?? t.repeatEvery,
    tags: t.tags ?? [],
    subtasks: t.subtasks ?? [],
    comments: t.comments ?? [],
    attachments: t.attachments ?? [],
    proofs: t.proofs ?? [],
    system: t.gennis_executor_id ? "gennis" : "turon",
    project_id: t.project_id ?? undefined,
  };
}

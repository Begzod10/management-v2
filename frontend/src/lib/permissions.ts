// ─────────────────────────────────────────────────────────────
//  ROLES  (иерархия — не меняется, все названия те же)
// ─────────────────────────────────────────────────────────────

export type Role =
  | "owner"
  | "admin"
  | "director"
  | "manager"
  | "hr"
  | "accountant"
  | "spiritualist"
  | "employee"
  | "user"
  | "volunteer";

// ─────────────────────────────────────────────────────────────
//  PERMISSIONS  (новый слой — функциональные права)
//
//  Зачем: одному пользователю можно выдать доп. права
//  не меняя его роль. Например, employee + "accounting"
//  получает доступ к бухгалтерии без роли accountant.
// ─────────────────────────────────────────────────────────────

export type Permission =
  | "accounting"      // доступ к финансам / бухгалтерии
  | "hr_manage"       // управление персоналом
  | "staff_read"      // просмотр персонала (без редактирования)
  | "jobs_manage"     // управление должностями
  | "salary_manage"   // управление зарплатами
  | "projects_manage" // управление проектами и отделами
  | "sections_manage" // управление отделами
  | "school_access"   // доступ к школьным страницам (calendar, students, teachers, groups, timetable)
  | "statistics";     // доступ к странице статистики (owner / admin)

// Каждая роль автоматически даёт эти права.
// director / hr / accountant — остаются, просто теперь
// их смысл выражен через permissions, а не через ранг.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner:        ["accounting", "hr_manage", "staff_read", "jobs_manage", "salary_manage", "projects_manage", "sections_manage", "school_access", "statistics"],
  admin:        ["accounting", "hr_manage", "staff_read", "jobs_manage", "salary_manage", "projects_manage", "sections_manage", "school_access", "statistics"],
  director:     ["staff_read", "projects_manage", "sections_manage", "school_access"],
  manager:      ["projects_manage", "sections_manage"],
  hr:           ["hr_manage", "staff_read", "jobs_manage"],
  accountant:   ["accounting", "salary_manage"],
  spiritualist: ["staff_read", "projects_manage", "sections_manage", "school_access"],
  employee:     [],
  user:         [],
  volunteer:    [],
};

// ─────────────────────────────────────────────────────────────
//  RANK  (иерархия для canEditTarget / assignableRoles)
// ─────────────────────────────────────────────────────────────

const ROLE_RANK: Record<Role, number> = {
  owner:        7,
  admin:        6,
  director:     5,
  manager:      4,
  hr:           3,
  accountant:   2,
  spiritualist: 2,
  employee:     1,
  user:         0,
  volunteer:    -1,
};

// ─────────────────────────────────────────────────────────────
//  PAGE ACCESS
//  Теперь страница требует Permission, а не список ролей.
//  null = доступна всем кроме volunteer.
// ─────────────────────────────────────────────────────────────

const PAGE_ACCESS: Record<string, Permission | null> = {
  dashboard: "accounting",
  tasks: null,           // volunteer тоже имеет доступ — см. canAccessPage
  profile: null,
  staff: "staff_read",   // director + hr + admin + owner
  user_profile: "staff_read",
  settings: "hr_manage",    // hr + admin + owner
  accounting: "accounting",   // accountant + admin + owner
  projects: "projects_manage",
  sections: "sections_manage",
  statistics:       "statistics",
  applications:     "statistics",
  school_calendar:  "school_access",
  school_students:  "school_access",
  school_teachers:  "school_access",
  school_groups:    "school_access",
  school_timetable: "school_access",
};

// Страницы открытые для volunteer
const VOLUNTEER_PAGES = new Set(["tasks"]);

// ─────────────────────────────────────────────────────────────
//  ACTIONS
//  Деструктивные действия (delete) остаются ранговыми.
// ─────────────────────────────────────────────────────────────

// Permission-based actions
const ACTION_PERMISSIONS: Record<string, Permission> = {
  staff_create: "hr_manage",
  staff_edit: "hr_manage",
  salary_manage: "salary_manage",
  jobs_manage: "jobs_manage",
};

// Rank-based actions (минимальный ранг)
const ACTION_MIN_RANK: Record<string, number> = {
  task_create: ROLE_RANK["user"],     // все роли
  staff_delete: ROLE_RANK["admin"],    // только owner / admin
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function getRole(role?: string): Role {
  return (role as Role) ?? "user";
}

function hasFullAccess(role?: string): boolean {
  const r = getRole(role);
  return r === "owner" || r === "admin";
}

export function roleRank(role?: string): number {
  return ROLE_RANK[getRole(role)] ?? 0;
}

/**
 * Есть ли у пользователя конкретное право?
 * extraPermissions — права выданные вручную (хранятся в БД / user-объекте).
 */
export function hasPermission(
  role: string | undefined,
  permission: Permission,
  extraPermissions: Permission[] = []
): boolean {
  const r = getRole(role);
  return ROLE_PERMISSIONS[r].includes(permission) || extraPermissions.includes(permission);
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC API  (все сигнатуры прежние, добавлен опц. параметр)
// ─────────────────────────────────────────────────────────────

/** Может ли viewer редактировать/удалять target? */
export function canEditTarget(
  viewerRole: string | undefined,
  targetRole: string | undefined
): boolean {
  if (hasFullAccess(viewerRole)) return true;
  return roleRank(viewerRole) > roleRank(targetRole);
}

/** Роли, которые viewer может назначать (только ниже своего ранга) */
export function assignableRoles(viewerRole: string | undefined): Role[] {
  const rank = roleRank(viewerRole);
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < rank);
}

/** Есть ли доступ к странице? */
export function canAccessPage(
  role: string | undefined,
  page: string,
  extraPermissions: Permission[] = []
): boolean {
  const required = PAGE_ACCESS[page];

  // Страница не в списке — открыта для всех
  if (required === undefined) return true;

  const r = getRole(role);

  // null = все кроме volunteer (если страница не в VOLUNTEER_PAGES)
  if (required === null) {
    return r !== "volunteer" || VOLUNTEER_PAGES.has(page);
  }

  return hasPermission(role, required, extraPermissions);
}

/** Может ли пользователь выполнить действие? */
export function canDo(
  role: string | undefined,
  action: string,
  extraPermissions: Permission[] = []
): boolean {
  // Сначала проверяем permission-based
  const perm = ACTION_PERMISSIONS[action];
  if (perm !== undefined) {
    return hasPermission(role, perm, extraPermissions);
  }

  // Затем rank-based
  const minRank = ACTION_MIN_RANK[action];
  if (minRank !== undefined) {
    return roleRank(role) >= minRank;
  }

  return false;
}

/**
 * Может ли пользователь только смотреть персонал (без редактирования)?
 * Теперь работает и для произвольных extraPermissions.
 */
export function staffReadOnly(
  role: string | undefined,
  extraPermissions: Permission[] = []
): boolean {
  return (
    hasPermission(role, "staff_read", extraPermissions) &&
    !hasPermission(role, "hr_manage", extraPermissions)
  );
}

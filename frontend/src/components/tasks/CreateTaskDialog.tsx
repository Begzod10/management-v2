import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useInstitution } from "@/contexts/InstitutionContext";
import { roleRank } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Minus, Plus, Loader2, ChevronDown, ChevronUp, ChevronRight, X, Globe, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExecutorSuggestion {
  user_id: number;
  name: string;
  role: string;
  score: number;
  reason: string;
}

interface Branch {
  id: number;
  name: string;
  director_id?: number;
  system_model_id?: number;
}

interface Director {
  id: number;
  name: string;
  surname: string;
  source: "gennis" | "turon";
  location_id: number | null;
  location_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
}

function directorLabel(d: Director): string {
  return d.location_name || d.branch_name || "";
}

function directorBranchId(d: Director): number {
  return d.branch_id ?? d.location_id ?? 0;
}

interface User {
  id: number;
  name: string;
  surname: string;
  role?: string;
}

// Normalize different API response shapes into a common User format.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePersons(list: any[]): User[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      id: item.id ?? item.user_id,
      name: item.name ?? item.first_name ?? "",
      surname: item.surname ?? item.last_name ?? "",
      role: item.role ?? undefined,
    }))
    .filter((u) => u.id != null && u.name);
}

interface EditTaskData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  deadline?: string;
  reviewer_id?: number;
  executor_id?: number;
  gennis_executor_id?: number | null;
  turon_executor_id?: number | null;
  kpi_weight?: number;
  penalty_per_day?: number;
  early_bonus_per_day?: number;
  max_bonus?: number;
  max_penalty?: number;
  is_recurring?: boolean;
  recurring_type?: string;
  repeat_every?: number;
  section_id?: number | null;
  project_id?: number | null;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editTask?: EditTaskData | null;
}

const SISTEMA = "sistema";

const defaultForm = {
  title: "",
  description: "",
  category: "academic" as string,
  reviewer_id: "" as string,
  branch_id: "" as string,
  deadline: undefined as Date | undefined,
  kpi_weight: 10,
  penalty_per_day: 2,
  early_bonus_per_day: 1,
  max_bonus: 3,
  max_penalty: 10,
  is_recurring: false,
  recurring_type: "daily" as string,
  repeat_every: 1,
};

export function CreateTaskDialog({ open, onOpenChange, onCreated, editTask }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const isEditMode = !!editTask;
  const [form, setForm] = useState({ ...defaultForm });
  const [executorIds, setExecutorIds] = useState<string[]>([]);
  // Owner mode: selected branch ids for executor assignment
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [managerSections, setManagerSections] = useState<{ id: number; name: string }[]>([]);
  const [managerProjectsLoaded, setManagerProjectsLoaded] = useState(false);
  const [managerSectionsLoaded, setManagerSectionsLoaded] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [selectionType, setSelectionType] = useState<"section" | "project" | "">("");
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [managementUsers, setManagementUsers] = useState<User[]>([]);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [sectionLeaders, setSectionLeaders] = useState<User[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<User[]>([]);
  const [executorOpen, setExecutorOpen] = useState(false);
  const [executorSearch, setExecutorSearch] = useState("");
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [reviewerSearch, setReviewerSearch] = useState("");
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<ExecutorSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchedRef = useRef<{ title: string; description: string } | null>(null);
  const autoSelectedIdRef = useRef<{ type: 'executor' | 'branch'; id: string } | null>(null);

  const isOwner = user?.role === "owner" || user?.role === "admin";
  const isManager = user?.role === "manager";
  const isBelowManager = !isOwner && !isManager && roleRank(user?.role ?? "user") < roleRank("manager");
  const managerProjects = useMemo(() => isManager ? projects : [], [isManager, projects]);
  // Track whether the last closed session was an edit, so create-after-edit starts fresh
  const lastSessionWasEdit = useRef(false);

  // Fetch eligible executors (with AI suggestions)
  const fetchSuggestions = async (title: string, description: string) => {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    // Don't fetch if title is too short
    if (trimmedTitle.length < 5) {
      setSuggestions([]);
      return;
    }

    // Don't fetch if content hasn't changed since last successful fetch
    if (
      lastFetchedRef.current &&
      lastFetchedRef.current.title === trimmedTitle &&
      lastFetchedRef.current.description === trimmedDesc
    ) {
      return;
    }

    // Don't fetch if creator_id is not available
    if (!user?.id) {
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoadingSuggestions(true);

    try {
      const payload = {
        title: trimmedTitle,
        description: trimmedDesc || null,
        creator_id: user.id,
        channel: "line_management",
        project_id: projectId && selectionType === "project" ? Number(projectId) : null,
        section_id: projectId && selectionType === "section" ? Number(projectId) : null,
        top_k: 3,
      };

      const res = await apiFetch("/missions/suggest-executor", {
        method: "POST",
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (res.ok) {
        const data: ExecutorSuggestion[] = await res.json();
        if (data.length > 0) {
          setSuggestions(data);
          lastFetchedRef.current = { title: trimmedTitle, description: trimmedDesc };

          // Auto-select user with highest score
          const topSuggestion = data.reduce((prev, current) =>
            current.score > prev.score ? current : prev
          );

          const newId = String(topSuggestion.user_id);

          // Remove previously auto-selected executor from BOTH arrays based on unique ID
          if (autoSelectedIdRef.current) {
            const prevId = autoSelectedIdRef.current.id;
            setExecutorIds(ids => ids.filter(id => id !== prevId));
            setSelectedBranchIds(ids => ids.filter(id => id !== prevId));
          }

          if (isOwner) {
            // For owner: check if it's a director or regular user
            const isDirector = directors.some(d => d.id === topSuggestion.user_id);

            // Use functional updates to check current state after removal
            if (isDirector) {
              setSelectedBranchIds(prev => {
                // Check if already exists in current state
                if (prev.includes(newId)) return prev;
                return [...prev, newId];
              });
              setExecutorIds(prev => {
                // Remove from executorIds if exists there
                return prev.filter(id => id !== newId);
              });
              autoSelectedIdRef.current = { type: 'branch', id: newId };
            } else {
              setExecutorIds(prev => {
                // Check if already exists in current state
                if (prev.includes(newId)) return prev;
                return [...prev, newId];
              });
              setSelectedBranchIds(prev => {
                // Remove from selectedBranchIds if exists there
                return prev.filter(id => id !== newId);
              });
              autoSelectedIdRef.current = { type: 'executor', id: newId };
            }
          } else {
            // For non-owner: just set executor
            setExecutorIds(prev => {
              if (prev.includes(newId)) return prev;
              return [...prev, newId];
            });
            autoSelectedIdRef.current = { type: 'executor', id: newId };
          }
        } else {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.name !== "AbortError") {
        setSuggestions([]);
      }
    } finally {
      setLoadingSuggestions(false);
      abortControllerRef.current = null;
    }
  };

  // Debounced suggestion fetch
  useEffect(() => {
    // Clear existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Abort any in-flight request when user types again
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const trimmedTitle = form.title.trim();

    // Don't trigger if title is too short or empty
    if (trimmedTitle.length < 5) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    // Don't trigger if user hasn't been resolved yet
    if (!user?.id) {
      return;
    }

    // Set debounced fetch
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(form.title, form.description);
    }, 700);

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [form.title, form.description, projectId, selectionType, user?.id]);

  // Pre-fill form when editing, conditionally reset when creating
  useEffect(() => {
    if (!open) return;
    if (!editTask) {
      // Only reset if coming from an edit session; otherwise preserve draft
      if (lastSessionWasEdit.current) {
        setForm({ ...defaultForm });
        setExecutorIds([]);
        setSelectedBranchIds([]);
        setProjectId("");
        setSelectionType("");
        setShowAdvanced(false);
        setSuggestions([]);
        autoSelectedIdRef.current = null;
        lastSessionWasEdit.current = false;
      }
      return;
    }
    // Mark that this session is an edit
    lastSessionWasEdit.current = true;
    setForm({
      title: editTask.title ?? "",
      description: editTask.description ?? "",
      category: editTask.category ?? "academic",
      reviewer_id: editTask.reviewer_id ? String(editTask.reviewer_id) : "",
      branch_id: "",
      deadline: editTask.deadline ? new Date(editTask.deadline) : undefined,
      kpi_weight: editTask.kpi_weight ?? 10,
      penalty_per_day: editTask.penalty_per_day ?? 2,
      early_bonus_per_day: editTask.early_bonus_per_day ?? 1,
      max_bonus: editTask.max_bonus ?? 3,
      max_penalty: editTask.max_penalty ?? 10,
      is_recurring: editTask.is_recurring ?? false,
      recurring_type: editTask.recurring_type ?? "daily",
      repeat_every: editTask.repeat_every ?? 1,
    });
    // Always reset both before setting
    setSelectedBranchIds([]);
    setExecutorIds([]);
    setSuggestions([]);
    autoSelectedIdRef.current = null;

    // Auto-fill section or project if present
    if (editTask.section_id) {
      setSelectionType("section");
      setProjectId(String(editTask.section_id));
    } else if (editTask.project_id) {
      setSelectionType("project");
      setProjectId(String(editTask.project_id));
    }

    if (isOwner) {
      const directorId = editTask.gennis_executor_id ?? editTask.turon_executor_id;
      if (directorId) {
        setSelectedBranchIds([String(directorId)]);
      } else if (editTask.executor_id) {
        // Regular user executor for owner
        setExecutorIds([String(editTask.executor_id)]);
      }
    } else if (editTask.executor_id) {
      setExecutorIds([String(editTask.executor_id)]);
    }
  }, [open, editTask]);

  useEffect(() => {
    if (!open) return;

    setManagerProjectsLoaded(false);
    setManagerSectionsLoaded(user?.role !== "manager");

    apiFetch("/branches/")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => { });

    apiFetch("/combined/directors")
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((data) => setDirectors(Array.isArray(data?.results) ? data.results : []))
      .catch(() => { });

    const urlProjects = user?.role === "manager" ? `/projects/?manager_id=${user.id}` : "/projects/";
    apiFetch(urlProjects)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setManagerProjectsLoaded(true));

    // Fetch sections for manager
    if (user?.role === "manager") {
      apiFetch(`/sections/?leader_id=${user.id}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setManagerSections(Array.isArray(data) ? data : []))
        .catch(() => setManagerSections([]))
        .finally(() => setManagerSectionsLoaded(true));
    }

    loadAssignableUsers();

    if (user?.role === "owner" || user?.role === "admin") {
      apiFetch("/users/project-managers")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setProjectManagers(normalizePersons(Array.isArray(data) ? data : [])))
        .catch(() => { });

      apiFetch("/users/section-leaders")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setSectionLeaders(normalizePersons(Array.isArray(data) ? data : [])))
        .catch(() => { });

      apiFetch("/users/unassigned")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setUnassignedUsers(normalizePersons(Array.isArray(data) ? data : [])))
        .catch(() => { });
    }
  }, [open, institution, user?.id, user?.role]);

  // Auto-select the only available section/project for managers during task creation.
  useEffect(() => {
    if (!open || !isManager || isEditMode || projectId) return;
    if (!managerProjectsLoaded || !managerSectionsLoaded) return;

    const options = [
      ...managerSections.map((section) => ({ type: "section" as const, id: section.id })),
      ...managerProjects.map((project) => ({ type: "project" as const, id: project.id })),
    ];

    if (options.length !== 1) return;

    setSelectionType(options[0].type);
    setProjectId(String(options[0].id));
    setExecutorIds([]);
    setProjectMembers([]);
  }, [
    open,
    isManager,
    isEditMode,
    projectId,
    managerProjectsLoaded,
    managerSectionsLoaded,
    managerProjects,
    managerSections,
  ]);

  // Fetch members when manager selects a section or project
  useEffect(() => {
    if (user?.role !== "manager" || !projectId || !selectionType) {
      setProjectMembers([]);
      return;
    }

    const endpoint = selectionType === "section"
      ? `/sections/${projectId}/members`
      : `/projects/${projectId}/members`;

    apiFetch(endpoint)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const members = (Array.isArray(data) ? data : [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m: any) => m.user)
          .filter(Boolean);

        const normalized = normalizePersons(members);
        const myRank = roleRank(user.role);
        const filtered = normalized.filter((u) => {
          if (!u.role) return true;
          return roleRank(u.role) < myRank;
        });

        setProjectMembers(filtered);
      })
      .catch(() => setProjectMembers([]));
  }, [projectId, selectionType, user?.role]);

  const loadAssignableUsers = async () => {
    const myRole = user?.role ?? "employee";
    const myRank = roleRank(myRole);

    const fetchJson = async (path: string): Promise<User[]> => {
      try {
        const r = await apiFetch(path);
        return r.ok ? normalizePersons(await r.json()) : [];
      } catch { return []; }
    };

    // exclude_non_staff=true — /users/ is 18.5k+ rows (mostly synced
    // gennis/turon students); fetching it unfiltered here downloaded a
    // ~3.5MB payload and froze the tab every time this dialog opened.
    const mgmt = await fetchJson("/users/?exclude_non_staff=true");
    setManagementUsers(mgmt);

    if (myRole === "manager") {
      // Manager users list starts empty — members load when section/project is selected
      setUsers([]);
      return;
    }

    let institutionPersons: User[] = [];

    const usesInstitutionEndpoints = ["admin", "director", "manager", "hr"];
    if (usesInstitutionEndpoints.includes(myRole)) {
      const [teachers, staff] = await Promise.all([
        fetchJson(`/${institution}/teachers`),
        fetchJson(`/${institution}/staff`),
      ]);
      const seen = new Set<number>();
      for (const p of [...teachers, ...staff]) {
        if (!seen.has(p.id)) { seen.add(p.id); institutionPersons.push(p); }
      }
    }

    if (myRole === "ad") {
      institutionPersons = await fetchJson(`/${institution}/teachers`);
    }

    const all = [...mgmt, ...institutionPersons];
    const deduped = Array.from(new Map(all.map((u) => [u.id, u])).values());

    const filtered = deduped.filter((u) => {
      if (!u.role) return true;
      return roleRank(u.role) < myRank;
    });

    // Below manager: can only assign to self — auto-select
    if (myRank < roleRank("manager")) {
      const self = mgmt.find((u) => u.id === Number(user?.id));
      const selfEntry = self ?? { id: Number(user?.id), name: user?.name ?? "", surname: user?.surname ?? "" };
      setUsers([selfEntry]);
      if (!isEditMode) setExecutorIds([String(selfEntry.id)]);
      return;
    }

    // Owner uses branches/directors for executor, management users for reviewer
    // Other roles use filtered list for both
    setUsers(filtered);
  };

  // Auto-set branch director when branch changes and no executor selected (non-owner)
  useEffect(() => {
    if (isOwner) return;
    if (!form.branch_id || form.branch_id === SISTEMA) return;
    const branch = branches.find((b) => String(b.id) === form.branch_id);
    if (branch?.director_id && executorIds.length === 0) {
      setExecutorIds([String(branch.director_id)]);
    }
  }, [form.branch_id, branches]);

  const set = <K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleExecutor = (id: string) => {
    setExecutorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // selectedBranchIds stores director IDs (as strings) for owner mode
  const toggleBranch = (directorId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(directorId) ? prev.filter((x) => x !== directorId) : [...prev, directorId]
    );
  };

  const toggleSystem = (source: string) => {
    const sourceDirectorIds = directors.filter((d) => d.source === source).map((d) => String(d.id));
    const allSelected = sourceDirectorIds.every((id) => selectedBranchIds.includes(id));
    if (allSelected) {
      setSelectedBranchIds((prev) => prev.filter((id) => !sourceDirectorIds.includes(id)));
    } else {
      setSelectedBranchIds((prev) => [...new Set([...prev, ...sourceDirectorIds])]);
    }
  };

  const toggleExpandSystem = (source: string) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const isSistema = form.branch_id === SISTEMA;

  const isValid = (() => {
    if (!form.title || !form.deadline) return false;
    if (!isBelowManager && !form.reviewer_id) return false;
    if (isOwner && selectedBranchIds.length === 0 && executorIds.length === 0) return false;
    if (isManager && executorIds.length === 0) return false;
    if (!isOwner && !isManager && !isBelowManager && !isSistema && executorIds.length === 0) return false;
    return true;
  })();

  const basePayload = () => ({
    title: form.title,
    description: form.description,
    category: form.category,
    reviewer_id: isBelowManager ? Number(user?.id) : Number(form.reviewer_id),
    deadline: format(form.deadline!, "yyyy-MM-dd"),
    kpi_weight: form.kpi_weight,
    penalty_per_day: form.penalty_per_day,
    early_bonus_per_day: form.early_bonus_per_day,
    max_bonus: form.max_bonus,
    max_penalty: form.max_penalty,
    is_recurring: form.is_recurring,
    recurring_type: form.recurring_type,
    repeat_every: form.repeat_every,
    tag_ids: [],
    channel: "line_management",
    ...(projectId && selectionType === "project" ? { project_id: Number(projectId) } : {}),
    ...(projectId && selectionType === "section" ? { section_id: Number(projectId) } : {}),
  });

  const buildPayload = (overrides: { executor_ids: number[]; branch_id?: number }) => {
    // Deduplicate executor_ids
    const uniqueExecutorIds = Array.from(new Set(overrides.executor_ids));
    const payload: Record<string, unknown> = {
      ...basePayload(),
      ...overrides,
      executor_ids: uniqueExecutorIds
    };
    // Remove zero/falsy optional fields
    if (!payload.branch_id) delete payload.branch_id;
    return payload;
  };

  const buildOwnerBulkPayload = () => {
    const selected = directors.filter((d) => selectedBranchIds.includes(String(d.id)));

    // Deduplicate executor_ids, and drop any id already represented as a director.
    // Director and regular-user ids share the same underlying id space, so a person
    // who is both (e.g. director + manager) must be sent once, not via both fields.
    const directorIdSet = new Set(selected.map((d) => d.id));
    const uniqueExecutorIds = Array.from(new Set(executorIds.map(Number))).filter(
      (id) => !directorIdSet.has(id)
    );

    return {
      ...basePayload(),
      gennis_executor_ids: selected
        .filter((d) => d.source === "gennis")
        .map((d) => ({ id: d.id, location_id: d.location_id, location_name: d.location_name })),
      turon_executor_ids: selected
        .filter((d) => d.source === "turon")
        .map((d) => ({ id: d.id, branch_id: d.branch_id, branch_name: d.branch_name })),
      executor_ids: uniqueExecutorIds,
    };
  };

  const handleSubmit = async () => {
    if (!isValid) {
      if (!form.title) toast.error("Sarlavha majburiy");
      else if (!form.deadline) toast.error("Muddat majburiy");
      else if (isOwner && selectedBranchIds.length === 0) toast.error("Filial tanlanmagan");
      else if (!isOwner && !isSistema && executorIds.length === 0) toast.error("Ijrochi tanlanmagan");
      else if (!form.reviewer_id) toast.error("Tekshiruvchi tanlanmagan");
      return;
    }

    setLoading(true);
    const creatorId = user?.id ?? 1;

    try {
      // Edit mode: PATCH existing task
      if (isEditMode && editTask) {
        const selectedDirs = directors.filter((d) => selectedBranchIds.includes(String(d.id)));
        const gennis = selectedDirs.filter((d) => d.source === "gennis");
        const turon = selectedDirs.filter((d) => d.source === "turon");
        const executorPatch: Record<string, unknown> = {};
        if (gennis.length > 0) {
          executorPatch.gennis_executor_id = gennis[0].id;
          executorPatch.location_id = gennis[0].location_id;
          executorPatch.location_name = gennis[0].location_name;
        } else if (turon.length > 0) {
          executorPatch.turon_executor_id = turon[0].id;
          executorPatch.branch_id = turon[0].branch_id;
          executorPatch.branch_name = turon[0].branch_name;
        } else if (executorIds.length > 0) {
          executorPatch.executor_id = Number(executorIds[0]);
        }
        const res = await apiFetch(`/missions/${editTask.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...basePayload(), ...executorPatch }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || "Xatolik yuz berdi");
          return;
        }
        toast.success("Vazifa yangilandi");
        setForm({ ...defaultForm });
        setExecutorIds([]);
        setSelectedBranchIds([]);
        setProjectId("");
        setSelectionType("");
        setShowAdvanced(false);
        autoSelectedIdRef.current = null;
        onCreated();
        onOpenChange(false);
        return;
      }

      if (isBelowManager) {
        const res = await apiFetch(`/missions/?creator_id=${creatorId}`, {
          method: "POST",
          body: JSON.stringify(buildPayload({
            executor_ids: [Number(user?.id)],
          })),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || "Xatolik yuz berdi");
          return;
        }
        toast.success("Vazifa yaratildi");
      } else if (isOwner) {
        const res = await apiFetch(`/missions/bulk?creator_id=${creatorId}`, {
          method: "POST",
          body: JSON.stringify(buildOwnerBulkPayload()),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || "Xatolik yuz berdi");
          return;
        }
        // Calculate unique count after deduplication (a person selected both as
        // director and as a regular user must count once, matching buildOwnerBulkPayload)
        const uniqueBranchIds = new Set(selectedBranchIds);
        const uniqueExecutorIds = new Set(executorIds.filter((id) => !uniqueBranchIds.has(id)));
        const totalCount = uniqueBranchIds.size + uniqueExecutorIds.size;
        toast.success(`${totalCount} ta ijrochiga vazifa yuborildi`);
      } else if (isSistema) {
        const results = await Promise.all(
          branches.map((branch) =>
            apiFetch(`/missions/?creator_id=${creatorId}`, {
              method: "POST",
              body: JSON.stringify(buildPayload({
                executor_ids: [branch.director_id ?? 0],
                branch_id: branch.id,
              })),
            })
          )
        );
        const failed = results.filter((r) => !r.ok).length;
        if (failed > 0) {
          toast.error(`${failed} ta filialga yuborib bo'lmadi`);
        } else {
          toast.success(`Barcha ${branches.length} ta filialga yuborildi`);
        }
      } else if (executorIds.length > 1) {
        // Deduplicate executor IDs before sending
        const uniqueExecutorIds = Array.from(new Set(executorIds));
        const results = await Promise.all(
          uniqueExecutorIds.map((execId) =>
            apiFetch(`/missions/?creator_id=${creatorId}`, {
              method: "POST",
              body: JSON.stringify(buildPayload({
                executor_ids: [Number(execId)],
                branch_id: Number(form.branch_id) || 0,
              })),
            })
          )
        );
        const failed = results.filter((r) => !r.ok).length;
        if (failed > 0) {
          toast.error(`${failed} ta ijrochiga yuborib bo'lmadi`);
        } else {
          toast.success(`${uniqueExecutorIds.length} ta ijrochiga vazifa yuborildi`);
        }
      } else {
        const res = await apiFetch(`/missions/?creator_id=${creatorId}`, {
          method: "POST",
          body: JSON.stringify(buildPayload({
            executor_ids: [Number(executorIds[0]) || 0],
            branch_id: Number(form.branch_id) || 0,
          })),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || "Xatolik yuz berdi");
          return;
        }
        toast.success("Vazifa yaratildi");
      }

      setForm({ ...defaultForm });
      setExecutorIds([]);
      setSelectedBranchIds([]);
      setProjectId("");
      setSelectionType("");
      setShowAdvanced(false);
      setSuggestions([]);
      lastFetchedRef.current = null;
      autoSelectedIdRef.current = null;
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setForm({ ...defaultForm });
    setExecutorIds([]);
    setSelectedBranchIds([]);
    setProjectId("");
    setSelectionType("");
    setShowAdvanced(false);
    setSuggestions([]);
    lastFetchedRef.current = null;
    autoSelectedIdRef.current = null;
  };

  const applySuggestion = (suggestion: ExecutorSuggestion) => {
    // Don't overwrite if user has already manually selected executors
    if (executorIds.length > 0 && !executorIds.includes(String(suggestion.user_id))) {
      // Add to existing selection instead of replacing
      setExecutorIds((prev) => [...prev, String(suggestion.user_id)]);
    } else if (executorIds.length === 0) {
      // First selection
      setExecutorIds([String(suggestion.user_id)]);
    }
    // Don't hide suggestions - let user pick multiple
  };

  const selectedExecutorUsers = [...users, ...projectMembers, ...(user ? [user] : [])]
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)
    .filter((u) => executorIds.includes(String(u.id)));

  // For owner: selected directors
  const selectedDirectors = directors.filter((d) => selectedBranchIds.includes(String(d.id)));

  const Stepper = ({ label, valueKey }: { label: string; valueKey: "kpi_weight" | "penalty_per_day" | "early_bonus_per_day" | "max_bonus" | "max_penalty" }) => (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
          onClick={() => set(valueKey, Math.max(0, (form[valueKey] as number) - 1))}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="font-mono text-sm w-8 text-center">{form[valueKey] as number}</span>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
          onClick={() => set(valueKey, (form[valueKey] as number) + 1)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  // Owner executor multiselect — directors grouped by source (gennis / turon) + project managers + section leaders
  // Defined as a plain render function (not a component) to avoid remounting on each parent re-render.
  const renderOwnerExecutorSelect = () => {
    const sources: Array<{ key: "gennis" | "turon"; label: string }> = [
      { key: "gennis", label: "Gennis" },
      { key: "turon", label: "Turon" },
    ];
    const selectedPMs = projectManagers.filter((u) => executorIds.includes(String(u.id)));
    const selectedSLs = sectionLeaders.filter((u) => executorIds.includes(String(u.id)));
    const selectedUAs = unassignedUsers.filter((u) => executorIds.includes(String(u.id)));
    const selfUser = user && executorIds.includes(String(user.id)) ? [user] : [];
    // The same person can appear in multiple role groups (e.g. project manager AND
    // section leader) or be selected both as a branch director and as a regular user.
    // Dedupe by real id so they are counted — and later submitted — only once.
    const directorIds = new Set(selectedDirectors.map((d) => d.id));
    const selectedUsers = Array.from(
      new Map(
        [...selfUser, ...selectedPMs, ...selectedSLs, ...selectedUAs]
          .filter((u) => !directorIds.has(u.id))
          .map((u) => [u.id, u])
      ).values()
    );
    const totalSelected = selectedDirectors.length + selectedUsers.length;

    return (
      <Popover open={executorOpen} onOpenChange={(v) => { setExecutorOpen(v); if (!v) setExecutorSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal h-auto min-h-10 py-1.5"
          >
            {totalSelected === 0 ? (
              <span className="text-muted-foreground text-sm">Tanlang</span>
            ) : totalSelected === 1 ? (
              <div className="flex items-center gap-1 min-w-0">
                <Badge variant="secondary" className="text-xs gap-1 pr-1 max-w-full truncate">
                  <span className="truncate">
                    {selectedDirectors.length === 1
                      ? `${selectedDirectors[0].name} ${selectedDirectors[0].surname} (${directorLabel(selectedDirectors[0])})`
                      : `${selectedUsers[0].name} ${selectedUsers[0].surname}`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedDirectors.length === 1) toggleBranch(String(selectedDirectors[0].id));
                      else toggleExecutor(String(selectedUsers[0].id));
                    }}
                    className="hover:text-destructive shrink-0"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {totalSelected} ta ijrochi
                </Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); setExecutorIds([]); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-1 h-80 flex flex-col"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Qidirish..."
              value={executorSearch}
              onChange={(e) => setExecutorSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {executorSearch && (
              <button onClick={() => setExecutorSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Loading indicator */}
            {loadingSuggestions && (
              <div className="flex items-center gap-2 px-2 py-2 text-muted-foreground border-b">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Tavsiyalar yuklanmoqda...</span>
              </div>
            )}

            {user && (() => {
              const q = executorSearch.toLowerCase();
              const matches = !q || `${user.name} ${user.surname}`.toLowerCase().includes(q);
              if (!matches) return null;
              return (
                <div
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer mb-1 border-b"
                  onClick={() => toggleExecutor(String(user.id))}
                >
                  <Checkbox checked={executorIds.includes(String(user.id))} onClick={(e) => e.stopPropagation()} />
                  <span className="text-sm font-semibold text-primary">O'zim ({user.name} {user.surname})</span>
                </div>
              );
            })()}

            {/* AI Recommendations Section for Owner */}
            {suggestions.length > 0 && !executorSearch && (
              <>
                <div className="px-2 py-1.5 select-none border-b">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase">Tavsiya etiladigan</span>
                  </div>
                </div>
                {suggestions.map((suggestion) => (
                  <div
                    key={`suggestion-${suggestion.user_id}`}
                    className="px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    onClick={() => toggleExecutor(String(suggestion.user_id))}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={executorIds.includes(String(suggestion.user_id))}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{suggestion.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {Math.round(suggestion.score * 100)}%
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-b my-1" />
              </>
            )}

            {/* Gennis & Turon director groups */}
            {sources.map(({ key, label }) => {
              const q = executorSearch.toLowerCase();
              const sourceDirectors = directors
                .filter((d) => d.source === key)
                .filter((d) => !q || `${d.name} ${d.surname} ${directorLabel(d)}`.toLowerCase().includes(q));
              if (sourceDirectors.length === 0) return null;
              const isExpanded = executorSearch ? true : expandedSystems.has(key);
              const sourceIds = sourceDirectors.map((d) => String(d.id));
              // For "select all" checkbox we use unfiltered ids so it reflects real selection state
              const allSourceIds = directors.filter((d) => d.source === key).map((d) => String(d.id));
              const allSelected = allSourceIds.every((id) => selectedBranchIds.includes(id));
              const someSelected = allSourceIds.some((id) => selectedBranchIds.includes(id));

              return (
                <div key={key}>
                  <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer select-none">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={() => toggleSystem(key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold"
                      onClick={() => !executorSearch && toggleExpandSystem(key)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      {label}
                      <span className="text-xs text-muted-foreground font-normal ml-auto">
                        {sourceDirectors.length} ta
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pl-4">
                      {sourceDirectors.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleBranch(String(d.id))}
                        >
                          <Checkbox
                            checked={selectedBranchIds.includes(String(d.id))}
                            onCheckedChange={() => toggleBranch(String(d.id))}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">
                            {d.name} {d.surname}
                            <span className="text-muted-foreground"> ({directorLabel(d)})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Project Managers group */}
            {(() => {
              const q = executorSearch.toLowerCase();
              const filtered = projectManagers.filter((u) => !q || `${u.name} ${u.surname}`.toLowerCase().includes(q));
              if (filtered.length === 0) return null;
              const isExpanded = executorSearch ? true : expandedSystems.has("pms");
              const userIds = projectManagers.map((u) => String(u.id));
              const allSelected = userIds.every((id) => executorIds.includes(id));
              const someSelected = userIds.some((id) => executorIds.includes(id));
              const toggleAllUsers = () => {
                if (allSelected) setExecutorIds((prev) => prev.filter((id) => !userIds.includes(id)));
                else setExecutorIds((prev) => [...new Set([...prev, ...userIds])]);
              };
              return (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer select-none">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={toggleAllUsers}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold"
                      onClick={() => !executorSearch && toggleExpandSystem("pms")}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      Loyiha Menejerlari
                      <span className="text-xs text-muted-foreground font-normal ml-auto">
                        {filtered.length} ta
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pl-4">
                      {filtered.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleExecutor(String(u.id))}
                        >
                          <Checkbox
                            checked={executorIds.includes(String(u.id))}
                            onCheckedChange={() => toggleExecutor(String(u.id))}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">{u.name} {u.surname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Section Leaders group */}
            {(() => {
              const q = executorSearch.toLowerCase();
              const filtered = sectionLeaders.filter((u) => !q || `${u.name} ${u.surname}`.toLowerCase().includes(q));
              if (filtered.length === 0) return null;
              const isExpanded = executorSearch ? true : expandedSystems.has("sls");
              const userIds = sectionLeaders.map((u) => String(u.id));
              const allSelected = userIds.every((id) => executorIds.includes(id));
              const someSelected = userIds.some((id) => executorIds.includes(id));
              const toggleAllUsers = () => {
                if (allSelected) setExecutorIds((prev) => prev.filter((id) => !userIds.includes(id)));
                else setExecutorIds((prev) => [...new Set([...prev, ...userIds])]);
              };
              return (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer select-none">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={toggleAllUsers}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold"
                      onClick={() => !executorSearch && toggleExpandSystem("sls")}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      Bo'lim Boshliqlari
                      <span className="text-xs text-muted-foreground font-normal ml-auto">
                        {filtered.length} ta
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pl-4">
                      {filtered.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleExecutor(String(u.id))}
                        >
                          <Checkbox
                            checked={executorIds.includes(String(u.id))}
                            onCheckedChange={() => toggleExecutor(String(u.id))}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">{u.name} {u.surname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Unassigned employees group */}
            {(() => {
              const q = executorSearch.toLowerCase();
              const filtered = unassignedUsers.filter((u) => !q || `${u.name} ${u.surname}`.toLowerCase().includes(q));
              if (filtered.length === 0) return null;
              const isExpanded = executorSearch ? true : expandedSystems.has("unassigned");
              const userIds = unassignedUsers.map((u) => String(u.id));
              const allSelected = userIds.every((id) => executorIds.includes(id));
              const someSelected = userIds.some((id) => executorIds.includes(id));
              const toggleAll = () => {
                if (allSelected) setExecutorIds((prev) => prev.filter((id) => !userIds.includes(id)));
                else setExecutorIds((prev) => [...new Set([...prev, ...userIds])]);
              };
              return (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer select-none">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={toggleAll}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold"
                      onClick={() => !executorSearch && toggleExpandSystem("unassigned")}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      Bo'limsiz xodimlar
                      <span className="text-xs text-muted-foreground font-normal ml-auto">
                        {filtered.length} ta
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pl-4">
                      {filtered.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleExecutor(String(u.id))}
                        >
                          <Checkbox
                            checked={executorIds.includes(String(u.id))}
                            onCheckedChange={() => toggleExecutor(String(u.id))}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">{u.name} {u.surname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (val === false) return;
        onOpenChange(val);
      }}
    >
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&>button:last-of-type]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Vazifani tahrirlash" : "Vazifa yaratish"}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div className="space-y-4">
          {/* Sarlavha */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Sarlavha *</Label>
              {loadingSuggestions && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>AI tavsiyalar yuklanmoqda...</span>
                </div>
              )}
            </div>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Vazifa nomi" />
          </div>

          {/* Tavsif */}
          <div>
            <Label>Tavsif</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Vazifa tavsifi" rows={3} />
          </div>

          {/* Kategoriya */}
          <div>
            <Label>Kategoriya</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Akademik</SelectItem>
                <SelectItem value="admin">Ma'muriyat</SelectItem>
                <SelectItem value="finance">Moliya</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bo'lim / Loyiha (faqat manager uchun) */}
          {isManager && (managerSections.length > 0 || managerProjects.length > 0) && (
            <div>
              <Label>Bo'lim / Loyiha</Label>
              <Select
                value={projectId ? `${selectionType}:${projectId}` : ""}
                onValueChange={(v) => {
                  const [type, id] = v.split(":");
                  setSelectionType(type as "section" | "project");
                  setProjectId(id);
                  setExecutorIds([]);
                  setProjectMembers([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bo'lim yoki loyihani tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {managerSections.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase select-none">Bo'limlar</div>
                      {managerSections.map((s) => (
                        <SelectItem key={`sec-${s.id}`} value={`section:${s.id}`}>{s.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {managerProjects.length > 0 && (
                    <>
                      {managerSections.length > 0 && <div className="border-t border-border my-1" />}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase select-none">Loyihalar</div>
                      {managerProjects.map((p) => (
                        <SelectItem key={`proj-${p.id}`} value={`project:${p.id}`}>{p.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filial selection UI removed as per user request */}

          {/* Ijrochi va Tekshiruvchi */}
          {!isBelowManager && <div className="grid grid-cols-2 gap-3">
            {/* Ijrochi */}
            <div className="min-w-0 overflow-hidden">
              <Label>Ijrochi *</Label>
              {isOwner ? (
                renderOwnerExecutorSelect()
              ) : isSistema ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted text-sm text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  Barcha direktorlar
                </div>
              ) : (
                <Popover open={executorOpen} onOpenChange={(v) => { setExecutorOpen(v); if (!v) setExecutorSearch(""); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal h-auto min-h-10 py-1.5"
                    >
                      {executorIds.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Tanlang</span>
                      ) : executorIds.length === 1 ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <Badge variant="secondary" className="text-xs gap-1 pr-1 max-w-full truncate">
                            <span className="truncate">
                              {selectedExecutorUsers[0]?.name} {selectedExecutorUsers[0]?.surname}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExecutor(String(selectedExecutorUsers[0]?.id)); }}
                              className="hover:text-destructive shrink-0"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {executorIds.length} ta ijrochi
                          </Badge>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExecutorIds([]); }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1 max-h-72 flex flex-col" align="start" onWheel={(e) => e.stopPropagation()}>
                    {/* Search input */}
                    <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder="Qidirish..."
                        value={executorSearch}
                        onChange={(e) => setExecutorSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {executorSearch && (
                        <button onClick={() => setExecutorSearch("")} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {/* Loading indicator */}
                      {loadingSuggestions && (
                        <div className="flex items-center gap-2 px-2 py-2 text-muted-foreground border-b">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Tavsiyalar yuklanmoqda...</span>
                        </div>
                      )}

                      {user && (() => {
                        const q = executorSearch.toLowerCase();
                        const matches = !q || `${user.name} ${user.surname}`.toLowerCase().includes(q);
                        if (!matches) return null;
                        return (
                          <div
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer mb-1 border-b"
                            onClick={() => toggleExecutor(String(user.id))}
                          >
                            <Checkbox checked={executorIds.includes(String(user.id))} onClick={(e) => e.stopPropagation()} />
                            <span className="text-sm font-semibold text-primary">O'zim ({user.name} {user.surname})</span>
                          </div>
                        );
                      })()}

                      {/* AI Recommendations Section */}
                      {suggestions.length > 0 && !executorSearch && (
                        <>
                          <div className="px-2 py-1.5 select-none border-b">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span className="text-xs font-semibold text-primary uppercase">Tavsiya etiladigan</span>
                            </div>
                          </div>
                          {suggestions.map((suggestion) => (
                            <div
                              key={`suggestion-${suggestion.user_id}`}
                              className="px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                              onClick={() => toggleExecutor(String(suggestion.user_id))}
                            >
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={executorIds.includes(String(suggestion.user_id))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium">{suggestion.name}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                      {Math.round(suggestion.score * 100)}%
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                                    {suggestion.reason}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="border-b my-1" />
                        </>
                      )}

                      {user?.role === "manager" ? (
                        <>
                          {(() => {
                            const q = executorSearch.toLowerCase();
                            const filtered = projectMembers
                              .filter(pm => String(pm.id) !== String(user?.id))
                              .filter(pm => !q || `${pm.name} ${pm.surname}`.toLowerCase().includes(q));
                            return (
                              <>
                                {filtered.length > 0 && (
                                  <div className="px-2 py-1.5 select-none">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                      {selectionType === "section" ? "Bo'lim a'zolari" : "Loyiha a'zolari"}
                                    </span>
                                  </div>
                                )}
                                {filtered.map((u) => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                                    onClick={() => toggleExecutor(String(u.id))}
                                  >
                                    <Checkbox checked={executorIds.includes(String(u.id))} onClick={(e) => e.stopPropagation()} />
                                    <span className="text-sm">{u.name} {u.surname}</span>
                                  </div>
                                ))}
                              </>
                            );
                          })()}
                          {!projectId && (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">Avval bo'lim yoki loyihani tanlang</div>
                          )}
                          {projectId && projectMembers.length === 0 && (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">A'zolar topilmadi</div>
                          )}
                        </>
                      ) : (
                        (() => {
                          const q = executorSearch.toLowerCase();
                          const filteredUsers = users
                            .filter(u => String(u.id) !== String(user?.id))
                            .filter(u => !q || `${u.name} ${u.surname}`.toLowerCase().includes(q));

                          return (
                            <>
                              {/* AI Recommendations for non-manager users */}
                              {suggestions.length > 0 && !q && (
                                <>
                                  <div className="px-2 py-1.5 select-none border-b">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="h-3 w-3 text-primary" />
                                      <span className="text-xs font-semibold text-primary uppercase">Tavsiya etiladigan</span>
                                    </div>
                                  </div>
                                  {suggestions.map((suggestion) => (
                                    <div
                                      key={`suggestion-${suggestion.user_id}`}
                                      className="px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                                      onClick={() => toggleExecutor(String(suggestion.user_id))}
                                    >
                                      <div className="flex items-start gap-2">
                                        <Checkbox
                                          checked={executorIds.includes(String(suggestion.user_id))}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium">{suggestion.name}</span>
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                              {Math.round(suggestion.score * 100)}%
                                            </Badge>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                                            {suggestion.reason}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="border-b my-1" />
                                </>
                              )}

                              {/* Regular users list */}
                              {filteredUsers.map((u) => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                                  onClick={() => toggleExecutor(String(u.id))}
                                >
                                  <Checkbox
                                    checked={executorIds.includes(String(u.id))}
                                    onCheckedChange={() => toggleExecutor(String(u.id))}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="text-sm">{u.name} {u.surname}</span>
                                </div>
                              ))}
                            </>
                          );
                        })()
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {!isOwner && form.branch_id && form.branch_id !== SISTEMA && executorIds.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Filial direktoriga yuboriladi</p>
              )}
            </div>

            {/* Tekshiruvchi */}
            <div>
              <Label>Tekshiruvchi *</Label>
              {(() => {
                const allReviewers: User[] = [];
                if (user) allReviewers.push(user as User);
                const pool = isOwner
                  ? managementUsers
                  : user?.role === "manager"
                    ? [...users, ...projectMembers.filter(pm => !users.some(u => String(u.id) === String(pm.id)))]
                    : users;
                for (const u of pool) {
                  if (String(u.id) !== String(user?.id)) allReviewers.push(u);
                }

                const q = reviewerSearch.toLowerCase();
                const filtered = allReviewers.filter((u) => !q || `${u.name} ${u.surname}`.toLowerCase().includes(q));
                const selectedReviewer = allReviewers.find((u) => String(u.id) === form.reviewer_id);

                return (
                  <Popover open={reviewerOpen} onOpenChange={(v) => { setReviewerOpen(v); if (!v) setReviewerSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal h-10 px-3">
                        {selectedReviewer ? (
                          <span className="truncate text-sm">
                            {String(selectedReviewer.id) === String(user?.id)
                              ? `O'zim (${selectedReviewer.name} ${selectedReviewer.surname})`
                              : `${selectedReviewer.name} ${selectedReviewer.surname}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Tanlang</span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-1 max-h-72 flex flex-col" align="start" onWheel={(e) => e.stopPropagation()}>
                      {/* Search input */}
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <input
                          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder="Qidirish..."
                          value={reviewerSearch}
                          onChange={(e) => setReviewerSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        {reviewerSearch && (
                          <button onClick={() => setReviewerSearch("")} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filtered.length === 0 && (
                          <div className="px-2 py-3 text-sm text-muted-foreground text-center">Topilmadi</div>
                        )}
                        {filtered.map((u, idx) => {
                          const isSelf = String(u.id) === String(user?.id);
                          return (
                            <div
                              key={u.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer ${idx === 0 && isSelf ? "border-b mb-0.5" : ""}`}
                              onClick={() => { set("reviewer_id", String(u.id)); setReviewerOpen(false); setReviewerSearch(""); }}
                            >
                              <div className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${form.reviewer_id === String(u.id) ? "bg-primary border-primary" : "border-input"}`}>
                                {form.reviewer_id === String(u.id) && (
                                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                )}
                              </div>
                              <span className={`text-sm ${isSelf ? "font-semibold text-primary" : ""}`}>
                                {isSelf ? `O'zim (${u.name} ${u.surname})` : `${u.name} ${u.surname}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>
          </div>}

          {/* Muddat */}
          <div>
            <Label>Muddat *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.deadline && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.deadline ? format(form.deadline, "dd.MM.yyyy") : "Sanani tanlang"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.deadline} onSelect={(d) => set("deadline", d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Takroriy */}
          <div className="flex items-center gap-2">
            <Checkbox id="recurring" checked={form.is_recurring} onCheckedChange={(v) => set("is_recurring", v === true)} />
            <Label htmlFor="recurring" className="cursor-pointer">Takroriy</Label>
          </div>

          {form.is_recurring && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <Label>Turi</Label>
                <Select value={form.recurring_type} onValueChange={(v) => set("recurring_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Kunlik</SelectItem>
                    <SelectItem value="weekly">Haftalik</SelectItem>
                    <SelectItem value="monthly">Oylik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Har nechada</Label>
                <Input type="number" min={1} value={form.repeat_every} onChange={(e) => set("repeat_every", Number(e.target.value))} />
              </div>
            </div>
          )}

          {/* Kengaytirilgan sozlamalar */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Checkbox checked={showAdvanced} onCheckedChange={(v) => setShowAdvanced(v === true)} />
              <span>Kengaytirilgan sozlamalar</span>
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 pl-6 grid grid-cols-2 gap-3">
                <Stepper label="KPI og'irligi" valueKey="kpi_weight" />
                <Stepper label="Jarima/kun" valueKey="penalty_per_day" />
                <Stepper label="Bonus/kun" valueKey="early_bonus_per_day" />
                <Stepper label="Maks. bonus" valueKey="max_bonus" />
                <Stepper label="Maks. jarima" valueKey="max_penalty" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClear} disabled={loading}>
            Tozalash
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Bekor qilish
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !isValid}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode
                ? "Saqlash"
                : isOwner
                  ? selectedBranchIds.length > 1
                    ? `${selectedBranchIds.length} ta filialga yuborish`
                    : "Yaratish"
                  : isSistema
                    ? `Barcha filiallarga yuborish (${branches.length})`
                    : executorIds.length > 1
                      ? `${executorIds.length} ta ijrochiga yuborish`
                      : "Yaratish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

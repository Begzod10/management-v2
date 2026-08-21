import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Task } from "@/data/mockData";
import { TaskListView } from "@/components/tasks/TaskListView";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskStatsView } from "@/components/tasks/TaskStatsView";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { mapApiTask, resolveTaskExecutorId } from "@/lib/taskMapper";
import { toast } from "sonner";

type TabValue = "my" | "assigned" | "reviewer" | "overdue" | "today" | "all" | "stats";

const VALID_TABS: TabValue[] = ["my", "assigned", "reviewer", "overdue", "today", "all", "stats"];

const TasksPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const tab: TabValue = (VALID_TABS.includes(searchParams.get("tab") as TabValue)
    ? searchParams.get("tab")
    : "my") as TabValue;
  const statusFilter = searchParams.get("status") ?? "all";
  const deptFilter = searchParams.get("dept") ?? "all";

  const fetchTasks = useCallback(async (activeTab: TabValue, activeStatus: string, activeDept: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "my" && user?.id) {
        params.set("executor_id", String(user.id));
      } else if (activeTab === "assigned" && user?.id) {
        params.set("creator_id", String(user.id));
      } else if (activeTab === "reviewer" && user?.id) {
        params.set("reviewer_id", String(user.id));
      } else if (activeTab === "overdue") {
        params.set("overdue", "true");
        if (user?.id) params.set("executor_id", String(user.id));
      } else if (activeTab === "today") {
        params.set("deadline", today);
        if (user?.id) params.set("executor_id", String(user.id));
      }
      // activeTab === "all": no user filter — fetch everything

      if (activeStatus === "overdue") {
        params.set("overdue", "true");
      } else if (activeStatus !== "all") {
        params.set("status", activeStatus);
      }
      if (activeDept !== "all") {
        params.set("category", activeDept);
      }
      const qs = params.toString();
      const res = await apiFetch(`/missions/${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.items ?? data.missions ?? []);
        setRawTasks(list);
        setTasks(list.map(mapApiTask));
      }
    } catch {
      // tarmoq xatosi
    } finally {
      setLoading(false);
    }
  }, [user?.id, today]);

  useEffect(() => {
    fetchTasks(tab, statusFilter, deptFilter);
  }, [tab, statusFilter, deptFilter, fetchTasks]);

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await apiFetch(`/missions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        toast.success("Vazifa o'chirildi");
      } else {
        toast.error("O'chirib bo'lmadi");
      }
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    }
  };

  const handleTabChange = (newTab: TabValue) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      next.set("status", "all");
      return next;
    }, { replace: true });
  };

  const handleStatusFilterChange = (val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("status", val);
      return next;
    }, { replace: true });
  };

  const handleDeptFilterChange = (val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("dept", val);
      return next;
    }, { replace: true });
  };

  return (
    <DashboardLayout title="Tasks">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TaskListView
          tasks={tasks}
          loading={loading}
          tab={tab}
          onTabChange={handleTabChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          deptFilter={deptFilter}
          onDeptFilterChange={handleDeptFilterChange}
          onSelectTask={(task) => navigate(`/tasks/${task.id}`, { state: { from: `${location.pathname}${location.search}` } })}
          onCreateTask={() => setShowCreate(true)}
          onEditTask={(task) => setEditTask(task)}
          onDeleteTask={handleDeleteTask}
          statsContent={<TaskStatsView />}
        />
      </div>
      <CreateTaskDialog
        open={showCreate || !!editTask}
        onOpenChange={(v) => {
          if (!v) { setShowCreate(false); setEditTask(null); }
        }}
        onCreated={() => fetchTasks(tab, statusFilter, deptFilter)}
        editTask={editTask ? (() => {
          const raw = rawTasks.find((r) => String(r.id) === editTask.id);
          return {
            id: editTask.id,
            title: editTask.title,
            description: editTask.description,
            category: editTask.department,
            deadline: editTask.deadline,
            reviewer_id: raw?.reviewer_id ?? raw?.reviewer?.id,
            executor_id: raw ? resolveTaskExecutorId(raw) : undefined,
            gennis_executor_id: raw?.gennis_executor_id ?? null,
            turon_executor_id: raw?.turon_executor_id ?? null,
            kpi_weight: editTask.kpiWeight,
            is_recurring: editTask.recurring,
            recurring_type: editTask.recurringType,
            repeat_every: editTask.repeatEvery,
            section_id: raw?.section_id ?? null,
            project_id: raw?.project_id ?? null,
          };
        })() : null}
      />
    </DashboardLayout>
  );
};

export default TasksPage;

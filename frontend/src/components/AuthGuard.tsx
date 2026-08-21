import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage } from "@/lib/permissions";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Wraps a page and redirects to "/" if the user's role cannot access it */
export function PageGuard({ page, children }: { page: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!canAccessPage(user?.role, page)) {
    return <Navigate to="/tasks" replace />;
  }

  return <>{children}</>;
}

export function AccountantOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.role !== "accountant" && user?.role !== "owner" && user?.role !== "admin") {
    return <Navigate to="/tasks" replace />;
  }

  return <>{children}</>;
}

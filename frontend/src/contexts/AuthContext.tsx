import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface AuthUser {
  id: number | string;
  email: string | null;
  name?: string;
  surname?: string;
  role?: string;
  is_active?: boolean;
  projects?: { id: number; name: string }[];
  sections?: { id: number; name: string }[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!token && !refreshToken) {
      setLoading(false);
      return;
    }
    apiFetch("/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("unauthorized");
      })
      .then(async (data) => {
        // /auth/me may not return role/salary/etc — fetch full profile
        try {
          const profileRes = await apiFetch(`/users/${data.id}`);
          if (profileRes.ok) {
            const profile = await profileRes.json();
            setUser({ ...data, ...profile });
            return;
          }
        } catch {}
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = async () => {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!token && !refreshToken) return;
    try {
      const res = await apiFetch("/auth/me");
      if (res.ok) {
        const data = await res.json();
        try {
          const profileRes = await apiFetch(`/users/${data.id}`);
          if (profileRes.ok) {
            const profile = await profileRes.json();
            setUser({ ...data, ...profile });
            return;
          }
        } catch {}
        setUser(data);
      }
    } catch {}
  };

  const signOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../models/auth";
import * as auth from "../services/authLocal";

const AuthContext = createContext<{
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  register: (
    p: { name: string; dob: string; cpf: string; email: string },
    password: string
  ) => Promise<void>;
  update: (
    p: { name: string; dob: string; cpf: string; email: string },
    currentPw: string | null,
    newPw?: string
  ) => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const cur = await auth.getCurrentResearcher();
    setUser(cur);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const api = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login: async (email: string, pw: string) => {
        const logged = await auth.login(email, pw);
        setUser(logged);
      },
      logout: async () => {
        await auth.logout();
        setUser(null);
      },
      refresh,
      register: async (
        p: { name: string; dob: string; cpf: string; email: string },
        password: string
      ) => {
        await auth.registerResearcher(p, password);
      },
      update: async (
        p: { name: string; dob: string; cpf: string; email: string },
        currentPw: string | null,
        newPw?: string
      ) => {
        if (!user) throw new Error("Sem sessão ativa.");
        const upd = await auth.updateResearcher(user.id, p, currentPw, newPw);
        setUser(upd);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
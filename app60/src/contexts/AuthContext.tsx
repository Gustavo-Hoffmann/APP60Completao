import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../models/auth";
import * as auth from "../services/authLocal";
import {
  setGuestMode,
  setGuestProfile,
  type GuestProfile,
} from "../services/guestSession";

const AuthContext = createContext<{
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  login: (
    email: string,
    password: string,
    options?: { deferSession?: boolean }
  ) => Promise<AuthUser>;
  finalizeLogin: (nextUser: AuthUser) => void;
  enterGuestMode: (profile: GuestProfile) => void;
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
  const [isGuest, setIsGuest] = useState(false);

  const applyAuthenticatedUser = (nextUser: AuthUser) => {
    setGuestProfile(null);
    setIsGuest(false);
    setUser(nextUser);
  };

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

  useEffect(() => {
    setGuestMode(isGuest);
  }, [isGuest]);

  const api = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user || isGuest,
      isGuest,
      login: async (
        email: string,
        pw: string,
        options?: { deferSession?: boolean }
      ) => {
        const logged = await auth.login(email, pw);
        if (!options?.deferSession) {
          applyAuthenticatedUser(logged);
        }
        return logged;
      },
      finalizeLogin: (nextUser: AuthUser) => {
        applyAuthenticatedUser(nextUser);
      },
      enterGuestMode: (profile: GuestProfile) => {
        setUser(null);
        setGuestProfile(profile);
        setIsGuest(true);
      },
      logout: async () => {
        try {
          if (!isGuest) {
            await auth.logout();
          }
        } finally {
          setGuestProfile(null);
          setIsGuest(false);
          setUser(null);
        }
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
    [user, loading, isGuest]
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client";
import type { AuthUser, SignInPayload } from "../types/auth";

type AuthContextType = {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: SignInPayload) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, professor_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  console.log("fetchProfile userId:", userId);
  console.log("fetchProfile data:", data);
  console.log("fetchProfile error:", error);

  if (error) {
    throw new Error(`Erro ao carregar perfil: ${error.message}`);
  }

  if (!data) {
    throw new Error("Perfil não encontrado.");
  }

  if (!data.is_active) {
    throw new Error("Seu usuário está inativo. Fale com o administrador.");
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    professor_id: data.professor_id,
    is_active: data.is_active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
  }, []);

  const loadProfileFromSession = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession?.user) {
        clearAuthState();
        return;
      }

      const profile = await fetchProfile(currentSession.user.id);
      setSession(currentSession);
      setUser(profile);
    },
    [clearAuthState]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        console.log("bootstrap session:", currentSession);
        console.log("bootstrap error:", error);

        if (error) throw error;
        if (!mounted) return;

        await loadProfileFromSession(currentSession);
      } catch (error) {
        console.error("bootstrap catch:", error);
        if (!mounted) return;
        clearAuthState();
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("onAuthStateChange:", event, newSession);

      if (!mounted) return;

      window.setTimeout(() => {
        if (!mounted) return;

        setIsLoading(true);

        void loadProfileFromSession(newSession)
          .catch((error) => {
            console.error("onAuthStateChange loadProfile catch:", error);
            if (!mounted) return;
            clearAuthState();
          })
          .finally(() => {
            if (!mounted) return;
            setIsLoading(false);
          });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState, loadProfileFromSession]);

  const login = useCallback(
    async ({ email, password }: SignInPayload) => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        console.log("signIn data:", data);
        console.log("signIn error:", error);

        if (error) {
          return { error: "Email ou senha inválidos." };
        }

        if (!data.user || !data.session) {
          return { error: "Não foi possível autenticar." };
        }

        const profile = await fetchProfile(data.user.id);

        setSession(data.session);
        setUser(profile);

        return { error: null };
      } catch (error) {
        console.error("login catch:", error);

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error("login signOut catch:", signOutError);
        }

        clearAuthState();

        return {
          error:
            error instanceof Error
              ? error.message
              : "Erro ao entrar. Tente novamente.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [clearAuthState]
  );

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error("logout catch:", error);
    } finally {
      clearAuthState();
      setIsLoading(false);
    }
  }, [clearAuthState]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;

    try {
      setIsLoading(true);
      const profile = await fetchProfile(userId);
      setUser(profile);
    } catch (error) {
      console.error("refreshProfile catch:", error);
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, clearAuthState]);

  const value = useMemo(
    () => ({
      user,
      session,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      refreshProfile,
    }),
    [user, session, isLoading, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return ctx;
}
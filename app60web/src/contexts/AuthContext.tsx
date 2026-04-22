import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiJson } from "../lib/api/client";
import { getValidIdToken, signInWithPassword, signOutCognito } from "../lib/cognito/session";
import type { AuthUser, SignInPayload } from "../types/auth";

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (payload: SignInPayload) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchMe(): Promise<AuthUser> {
  const data = await apiJson<{
    id: string;
    email: string;
    name: string;
    role: AuthUser["role"];
    institution_id: string | null;
    institution_name: string | null;
    is_active: boolean;
  }>("/api/me");

  if (!data.is_active) {
    throw new Error("Seu usuário está inativo. Fale com o administrador.");
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    institution_id: data.institution_id,
    institution_name: data.institution_name,
    is_active: data.is_active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await getValidIdToken();
    if (!token) {
      clearAuthState();
      return;
    }
    const profile = await fetchMe();
    setUser(profile);
  }, [clearAuthState]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setIsLoading(true);
        const token = await getValidIdToken();
        if (!mounted) return;
        if (!token) {
          clearAuthState();
          return;
        }
        const profile = await fetchMe();
        if (!mounted) return;
        setUser(profile);
        setAuthError(null);
      } catch (err: unknown) {
        if (!mounted) return;
        const message =
          err instanceof Error && err.message ? err.message : "Falha ao validar sessão.";
        setAuthError(message);
        setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [clearAuthState]);

  const login = useCallback(
    async ({ email, password }: SignInPayload) => {
      try {
        setIsLoading(true);
        await signInWithPassword(email, password);
        const profile = await fetchMe();
        setUser(profile);
        setAuthError(null);
        return { error: null };
      } catch (err: unknown) {
        signOutCognito();
        clearAuthState();
        const message =
          err instanceof Error && err.message
            ? err.message
            : "E-mail ou senha inválidos.";
        setAuthError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [clearAuthState]
  );

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      signOutCognito();
    } finally {
      clearAuthState();
      setIsLoading(false);
    }
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      authError,
      login,
      logout,
      refreshProfile,
    }),
    [user, isLoading, authError, login, logout, refreshProfile]
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

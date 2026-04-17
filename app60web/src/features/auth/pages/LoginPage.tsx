import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../contexts/AuthContext";
import { getRememberMe, setRememberMe } from "../../../lib/cognito/pool";
import { routes } from "../../../navigation/routes";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState(() => getRememberMe());
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLocalError(null);
  }, [email, password]);

  if (isAuthenticated) {
    return <Navigate to={routes.dashboard} replace />;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Preencha email e senha.");
      return;
    }

    try {
      setSubmitting(true);

      setRememberMe(rememberMe);
      const result = await login({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setLocalError(result.error);
        return;
      }

      navigate(routes.dashboard, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <img
            src="/logo-seniorsense.png"
            alt="SeniorSense 60+"
            className="mx-auto h-20 w-full max-w-[320px] object-contain"
          />
          <p className="mt-4 text-center text-sm text-slate-500">
            Entre com seu email e senha cadastrados pelo administrador.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Senha
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                className="pr-12"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                disabled={submitting}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMeState(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
            />
            Lembrar de mim
          </label>

          {localError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {localError}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
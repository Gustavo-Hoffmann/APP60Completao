import { CognitoUserPool } from "amazon-cognito-identity-js";

function requireEnv(name: keyof ImportMetaEnv): string {
  const v = import.meta.env[name];
  if (!v || typeof v !== "string") {
    throw new Error(`Falta ${name} no .env (Vite)`);
  }
  return v;
}

let pool: CognitoUserPool | null = null;

const REMEMBER_ME_KEY = "app60.rememberMe";
const REMEMBER_EMAIL_KEY = "app60.rememberEmail";

function readRememberMe(): boolean {
  try {
    const v = window.localStorage.getItem(REMEMBER_ME_KEY);
    if (v === null) return true; // default: persiste login
    return v === "1";
  } catch {
    return false;
  }
}

export function setRememberMe(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, remember ? "1" : "0");
  } catch {
    // ignore (storage indisponível)
  }
  // garante que novas instâncias usem o storage correto
  pool = null;
}

export function getRememberMe(): boolean {
  return readRememberMe();
}

export function getRememberedEmail(): string {
  try {
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setRememberedEmail(email: string): void {
  try {
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
  } catch {
    // ignore (storage indisponível)
  }
}

export function clearRememberedEmail(): void {
  try {
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    // ignore
  }
}

function bestEffortStorage(): Storage {
  try {
    return readRememberMe() ? window.localStorage : window.sessionStorage;
  } catch {
    return window.sessionStorage;
  }
}

export function getCognitoPool(): CognitoUserPool {
  if (!pool) {
    pool = new CognitoUserPool({
      UserPoolId: requireEnv("VITE_COGNITO_USER_POOL_ID"),
      ClientId: requireEnv("VITE_COGNITO_CLIENT_ID"),
      Storage: bestEffortStorage(),
    });
  }
  return pool;
}

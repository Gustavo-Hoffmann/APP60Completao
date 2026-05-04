import Constants from "expo-constants";

export type AppVariant = "development" | "staging";

type Extra = Record<string, unknown> | undefined;

function readExtra(): Extra {
  const e1 = Constants.expoConfig?.extra as Extra;
  const e2 = (Constants.manifest2?.extra as Extra) ?? undefined;
  return e1 ?? e2;
}

function readString(key: string): string | undefined {
  const fromEnv = (process.env as Record<string, string | undefined>)[key];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();

  const extra = readExtra();
  const fromExtra = extra?.[key];
  if (typeof fromExtra === "string" && fromExtra.trim()) return fromExtra.trim();

  return undefined;
}

function normalizeBaseUrl(u: string): string {
  return u.replace(/\/$/, "");
}

export const APP_VARIANT: AppVariant = (() => {
  const raw =
    readString("EXPO_PUBLIC_APP_VARIANT") ??
    readString("appVariant") ??
    readString("APP_VARIANT") ??
    "development";
  return raw === "staging" ? "staging" : "development";
})();

export const IS_STAGING = APP_VARIANT === "staging";
export const IS_DEVELOPMENT = APP_VARIANT === "development";

export const API_BASE_URL: string = (() => {
  const raw =
    readString("EXPO_PUBLIC_API_BASE_URL") ??
    readString("apiBaseUrl") ??
    (IS_DEVELOPMENT ? "https://api-staging.seniorsenseplus.com" : "");

  const url = raw ? normalizeBaseUrl(raw) : "";

  if (IS_STAGING) {
    if (!url) {
      throw new Error(
        "STAGING: EXPO_PUBLIC_API_BASE_URL está vazio. Configure para https://api-staging.seniorsenseplus.com"
      );
    }
    if (!url.includes("api-staging")) {
      throw new Error(`STAGING: API_BASE_URL inválida (precisa conter "api-staging"): ${url}`);
    }
    if (url.includes("api.seniorsenseplus.com") && !url.includes("staging")) {
      throw new Error(`STAGING: API_BASE_URL aponta para produção: ${url}`);
    }
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      throw new Error(`STAGING: API_BASE_URL não pode ser local: ${url}`);
    }
  } else {
    // development: permitido apontar para localhost, IP local ou staging.
    // Log intencional para evitar confusão durante testes locais.
    // eslint-disable-next-line no-console
    console.log(`[env] APP_VARIANT=development API_BASE_URL=${url || "(vazio)"}`);
  }

  return url;
})();

export const COGNITO_REGION: string = (() => {
  const v = readString("EXPO_PUBLIC_COGNITO_REGION") ?? readString("cognitoRegion") ?? "";
  if (IS_STAGING && !v) {
    throw new Error("STAGING: EXPO_PUBLIC_COGNITO_REGION está vazio.");
  }
  return v || "us-east-1";
})();

export const COGNITO_USER_POOL_ID: string = (() => {
  const v =
    readString("EXPO_PUBLIC_COGNITO_USER_POOL_ID") ?? readString("cognitoUserPoolId") ?? "";
  if (IS_STAGING && !v) {
    throw new Error("STAGING: EXPO_PUBLIC_COGNITO_USER_POOL_ID está vazio.");
  }
  return v || "TODO_COGNITO_USER_POOL_ID";
})();

export const COGNITO_CLIENT_ID: string = (() => {
  const v = readString("EXPO_PUBLIC_COGNITO_CLIENT_ID") ?? readString("cognitoClientId") ?? "";
  if (IS_STAGING && !v) {
    throw new Error("STAGING: EXPO_PUBLIC_COGNITO_CLIENT_ID está vazio.");
  }
  return v || "TODO_COGNITO_CLIENT_ID";
})();

export const ENV_LABEL = IS_STAGING ? "STAGING" : "DEV";


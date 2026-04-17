import Constants from "expo-constants";

const extra =
  (Constants.expoConfig?.extra as Record<string, string | undefined> | undefined) ??
  (Constants.manifest2?.extra as Record<string, string | undefined> | undefined) ??
  {};

export function getApiBaseUrl(): string {
  const u = extra.apiBaseUrl;
  if (!u) throw new Error("Configure expo.extra.apiBaseUrl no app.json / app.config");
  return u.replace(/\/$/, "");
}

export function getCognitoRegion(): string {
  const r = extra.cognitoRegion;
  if (!r) throw new Error("Configure expo.extra.cognitoRegion");
  return r;
}

export function getCognitoUserPoolId(): string {
  const id = extra.cognitoUserPoolId;
  if (!id) throw new Error("Configure expo.extra.cognitoUserPoolId");
  return id;
}

export function getCognitoClientId(): string {
  const id = extra.cognitoClientId;
  if (!id) throw new Error("Configure expo.extra.cognitoClientId");
  return id;
}

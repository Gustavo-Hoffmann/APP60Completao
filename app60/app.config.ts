import type { ConfigContext } from "expo/config";

type AppVariant = "development" | "staging";

function getVariant(): AppVariant {
  const v = (
    process.env.APP_VARIANT ||
    process.env.EXPO_PUBLIC_APP_VARIANT ||
    "development"
  ).trim();

  return v === "staging" ? "staging" : "development";
}

function withSuffix(base: string, variant: AppVariant): string {
  if (!base) return base;
  if (variant !== "staging") return base;
  return base.endsWith(".staging") ? base : `${base}.staging`;
}

export default ({ config }: ConfigContext) => {
  const variant = getVariant();

  const baseBundleIdentifier = config.ios?.bundleIdentifier ?? "br.ufpr.app60";
  const baseAndroidPackage = config.android?.package ?? "br.ufpr.app60";

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined);

  const cognitoRegion =
    process.env.EXPO_PUBLIC_COGNITO_REGION ??
    (config.extra?.cognitoRegion as string | undefined);

  const cognitoUserPoolId =
    process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID ??
    (config.extra?.cognitoUserPoolId as string | undefined);

  const cognitoClientId =
    process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ??
    (config.extra?.cognitoClientId as string | undefined);

  return {
    ...config,

    name: variant === "staging" ? "SeniorSense+ Staging" : config.name ?? "app60",

    scheme: variant === "staging" ? "app60-staging" : config.scheme ?? "app60",

    ios: {
      ...config.ios,
      bundleIdentifier: withSuffix(baseBundleIdentifier, variant),
    },

    android: {
      ...config.android,
      package: withSuffix(baseAndroidPackage, variant),
    },

    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...(((config.extra as unknown as { eas?: Record<string, unknown> } | undefined)
          ?.eas ?? {}) as Record<string, unknown>),
        projectId: "49ee0437-ef3f-4e5b-9149-640c5ad0ba43",
      },
      appVariant: variant,
      apiBaseUrl,
      cognitoRegion,
      cognitoUserPoolId,
      cognitoClientId,
    },
  };
};
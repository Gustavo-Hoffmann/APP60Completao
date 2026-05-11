import { Alert } from "react-native";

export function isTransientSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /HTTP\s*502|HTTP\s*503|HTTP\s*504|\b502\b|\b503\b|\b504\b|timeout|timed out|network request failed|fetch failed|temporar/i.test(
    message
  );
}

export function showCloudSyncWarning(
  t: (key: string, options?: Record<string, unknown>) => string
) {
  Alert.alert(t("tests:common.sync.warningTitle"), t("tests:common.sync.warningBody"));
}

export function showCloudUploadFailure(
  t: (key: string, options?: Record<string, unknown>) => string,
  error: unknown
) {
  if (isTransientSyncError(error)) {
    showCloudSyncWarning(t);
    return;
  }

  const message = error instanceof Error ? error.message : t("tests:common.upload.errorBody");
  Alert.alert(t("tests:common.upload.errorTitle"), message);
}

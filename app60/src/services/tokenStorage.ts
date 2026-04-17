import * as SecureStore from "expo-secure-store";

const K_ID = "app60_id_token";
const K_ACCESS = "app60_access_token";
const K_REFRESH = "app60_refresh_token";

export async function saveTokens(input: {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}) {
  await SecureStore.setItemAsync(K_ID, input.idToken);
  await SecureStore.setItemAsync(K_ACCESS, input.accessToken);
  await SecureStore.setItemAsync(K_REFRESH, input.refreshToken);
}

export async function getIdToken(): Promise<string | null> {
  return SecureStore.getItemAsync(K_ID);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(K_ID);
  await SecureStore.deleteItemAsync(K_ACCESS);
  await SecureStore.deleteItemAsync(K_REFRESH);
}

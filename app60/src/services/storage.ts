import AsyncStorage from "@react-native-async-storage/async-storage";

export async function setJSON(key: string, value: any) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function removeKey(key: string) {
  await AsyncStorage.removeItem(key);
}
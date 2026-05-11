import AsyncStorage from "@react-native-async-storage/async-storage";

import { isGuestMode } from "../guestSession";
import { getNextSessionNumber, type SupportedTestType } from "./uploadTestJson";

const STORAGE_PREFIX = "app60.localSession.";

function storageKey(participantId: string, testType: SupportedTestType) {
  return `${STORAGE_PREFIX}${participantId}:${testType}`;
}

async function readLocalSessionCounter(participantId: string, testType: SupportedTestType) {
  const raw = await AsyncStorage.getItem(storageKey(participantId, testType));
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function writeLocalSessionCounter(
  participantId: string,
  testType: SupportedTestType,
  value: number
) {
  await AsyncStorage.setItem(storageKey(participantId, testType), String(Math.max(1, Math.floor(value))));
}

async function bumpLocalSessionCounter(participantId: string, testType: SupportedTestType) {
  const current = await readLocalSessionCounter(participantId, testType);
  const next = current + 1;
  await writeLocalSessionCounter(participantId, testType, next);
  return next;
}

export async function resolveSessionNumberForLocalSave(
  participantId: string,
  testType: SupportedTestType
): Promise<{ sessionNumber: number; fromCloud: boolean }> {
  if (isGuestMode()) {
    const sessionNumber = await bumpLocalSessionCounter(participantId, testType);
    return { sessionNumber, fromCloud: false };
  }

  try {
    const sessionNumber = await getNextSessionNumber(participantId, testType);
    await writeLocalSessionCounter(participantId, testType, sessionNumber);
    return { sessionNumber, fromCloud: true };
  } catch {
    const sessionNumber = await bumpLocalSessionCounter(participantId, testType);
    return { sessionNumber, fromCloud: false };
  }
}

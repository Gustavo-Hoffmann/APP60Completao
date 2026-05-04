import * as Speech from "expo-speech";
import { Platform } from "react-native";
import i18n from "../i18n";

function speechLanguage() {
  const lang = i18n.resolvedLanguage ?? i18n.language;
  if (lang?.toLowerCase().startsWith("en")) return "en-GB";
  return "pt-BR";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const SPEAK_MAX_WAIT_MS = 12_000;

export async function speakText(text: string) {
  try {
    const SpeechModule: any = Speech as any;
    if (!SpeechModule || typeof SpeechModule.speak !== "function") return;

    await Promise.race([
      new Promise<void>((resolve) => {
        Speech.speak(text, {
          language: speechLanguage(),
          rate: 0.92,
          pitch: 1.0,
          /**
           * iOS: com `true`, o TTS usa a sessão de áudio da app (e não uma sessão
           * separada que obedece ao silencioso lateral). Não exige o módulo nativo
           * `expo-av` / `ExponentAV`.
           */
          ...(Platform.OS === "ios" ? { useApplicationAudioSession: true } : {}),
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      }),
      sleep(SPEAK_MAX_WAIT_MS),
    ]);
  } catch {}
}

export async function speakTextMinDuration(text: string, minMs: number) {
  await Promise.all([speakText(text), sleep(Math.max(0, minMs))]);
}

export function stopSpeech() {
  try {
    const SpeechModule: any = Speech as any;
    if (SpeechModule && typeof SpeechModule.stop === "function") {
      Speech.stop();
    }
  } catch {}
}

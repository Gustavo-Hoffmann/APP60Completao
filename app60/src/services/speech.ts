import * as Speech from "expo-speech";
import i18n from "../i18n";

function speechLanguage() {
  const lang = i18n.resolvedLanguage ?? i18n.language;
  if (lang?.toLowerCase().startsWith("en")) return "en-GB";
  return "pt-BR";
}

export async function speakText(text: string) {
  try {
    const SpeechModule: any = Speech as any;
    if (!SpeechModule || typeof SpeechModule.speak !== "function") return;

    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: speechLanguage(),
        rate: 0.92,
        pitch: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  } catch {}
}

export function stopSpeech() {
  try {
    const SpeechModule: any = Speech as any;
    if (SpeechModule && typeof SpeechModule.stop === "function") {
      Speech.stop();
    }
  } catch {}
}

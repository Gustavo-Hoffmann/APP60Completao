import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { AppShell } from "./src/app/AppShell";
import "./src/i18n";

export default function App() {
  useEffect(() => {
    const anyGlobal: any = global as any;
    const ErrorUtils = anyGlobal?.ErrorUtils;
    if (!ErrorUtils?.getGlobalHandler || !ErrorUtils?.setGlobalHandler) return;

    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((err: any, isFatal?: boolean) => {
      try {
        const msg = String(err?.message ?? err);
        const stack = String(err?.stack ?? "");
        // eslint-disable-next-line no-console
        console.error("[global-error]", { isFatal: !!isFatal, message: msg, stack });
      } catch {
        // ignore
      }
      if (typeof prev === "function") prev(err, isFatal);
    });
  }, []);

  return <AppShell />;
}
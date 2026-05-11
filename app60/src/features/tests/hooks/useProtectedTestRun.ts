import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, BackHandler } from "react-native";

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";

export type UseProtectedTestRunOptions = {
  isRunning: boolean;
  durationMs?: number;
  testName?: string;
  navigation?: any;
  onAutoFinish?: () => void | Promise<void>;
  onBeforeExitBlocked?: () => void;
  enabled?: boolean;
};

export type UseProtectedTestRunReturn = {
  locked: boolean;
  unlocked: boolean;
  tapCount: number;
  startedAtMsRef: React.MutableRefObject<number | null>;
  elapsedMs: number;
  handleLockTap: () => void;
  canStopManually: boolean;
  guardedStop: (stopFn: () => void | Promise<void>) => Promise<void>;
  forceLock: () => void;
  forceUnlock: () => void;
  resetProtection: () => void;
};

const KEEP_AWAKE_TAG = "protected-test-run";

const TAP_WINDOW_MS = 1200;
const UNLOCK_GRACE_MS = 8000;
const REQUIRED_TAPS = 3;

type Timer = ReturnType<typeof setTimeout>;
type Interval = ReturnType<typeof setInterval>;

function clearTimer(ref: React.MutableRefObject<Timer | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

function clearIntervalRef(ref: React.MutableRefObject<Interval | null>) {
  if (ref.current) {
    clearInterval(ref.current);
    ref.current = null;
  }
}

type ExpoNotificationsLike = {
  scheduleNotificationAsync: (input: {
    content: { title?: string; body?: string };
    trigger: any;
  }) => Promise<string>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
};

let cachedNotifications: ExpoNotificationsLike | null | undefined;

function tryGetNotifications(): ExpoNotificationsLike | null {
  if (cachedNotifications !== undefined) return cachedNotifications;

  try {
    const mod = require("expo-notifications");
    if (
      mod &&
      typeof mod.scheduleNotificationAsync === "function" &&
      typeof mod.cancelScheduledNotificationAsync === "function"
    ) {
      cachedNotifications = mod as ExpoNotificationsLike;
      return cachedNotifications;
    }
  } catch {
    /* expo-notifications not available */
  }

  cachedNotifications = null;
  return null;
}

export function useProtectedTestRun(
  options: UseProtectedTestRunOptions
): UseProtectedTestRunReturn {
  const {
    isRunning,
    durationMs,
    testName = "test",
    navigation,
    onAutoFinish,
    onBeforeExitBlocked,
    enabled = true,
  } = options;

  const [locked, setLocked] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const lockedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);

  const startedAtMsRef = useRef<number | null>(null);
  const tapWindowTimerRef = useRef<Timer | null>(null);
  const relockTimerRef = useRef<Timer | null>(null);
  const elapsedTimerRef = useRef<Interval | null>(null);
  const autoFinishTimerRef = useRef<Timer | null>(null);

  const finishCalledRef = useRef<boolean>(false);
  const stopCalledRef = useRef<boolean>(false);
  const keepAwakeActiveRef = useRef<boolean>(false);
  const notificationIdRef = useRef<string | null>(null);
  const mountedRef = useRef<boolean>(true);

  const onAutoFinishRef = useRef(onAutoFinish);
  const onBeforeExitBlockedRef = useRef(onBeforeExitBlocked);
  useEffect(() => {
    onAutoFinishRef.current = onAutoFinish;
  }, [onAutoFinish]);
  useEffect(() => {
    onBeforeExitBlockedRef.current = onBeforeExitBlocked;
  }, [onBeforeExitBlocked]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetLocked = useCallback((v: boolean) => {
    if (!mountedRef.current) return;
    setLocked(v);
  }, []);

  const safeSetTapCount = useCallback((v: number) => {
    if (!mountedRef.current) return;
    setTapCount(v);
  }, []);

  const safeSetElapsed = useCallback((v: number) => {
    if (!mountedRef.current) return;
    setElapsedMs(v);
  }, []);

  const activateKeepAwakeSafe = useCallback(async () => {
    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      keepAwakeActiveRef.current = true;
    } catch (err) {
      console.warn(`[${testName}] keep-awake activate failed:`, err);
    }
  }, [testName]);

  const deactivateKeepAwakeSafe = useCallback(async () => {
    if (!keepAwakeActiveRef.current) return;
    try {
      await deactivateKeepAwake(KEEP_AWAKE_TAG);
    } catch (err) {
      console.warn(`[${testName}] keep-awake deactivate failed:`, err);
    } finally {
      keepAwakeActiveRef.current = false;
    }
  }, [testName]);

  const scheduleFinishNotification = useCallback(async () => {
    if (!durationMs || durationMs <= 0) return;

    const notifications = tryGetNotifications();
    if (!notifications) return;

    try {
      const id = await notifications.scheduleNotificationAsync({
        content: {
          title: "Teste finalizado",
          body: "A coleta atingiu o tempo programado.",
        },
        trigger: { seconds: Math.max(1, Math.round(durationMs / 1000)) },
      });
      notificationIdRef.current = id;
    } catch (err) {
      console.warn(`[${testName}] schedule notification failed:`, err);
    }
  }, [durationMs, testName]);

  const cancelFinishNotification = useCallback(async () => {
    const id = notificationIdRef.current;
    if (!id) return;
    notificationIdRef.current = null;

    const notifications = tryGetNotifications();
    if (!notifications) return;

    try {
      await notifications.cancelScheduledNotificationAsync(id);
    } catch (err) {
      console.warn(`[${testName}] cancel notification failed:`, err);
    }
  }, [testName]);

  const cleanupProtection = useCallback(() => {
    clearTimer(tapWindowTimerRef);
    clearTimer(relockTimerRef);
    clearTimer(autoFinishTimerRef);
    clearIntervalRef(elapsedTimerRef);
  }, []);

  const safeAutoFinish = useCallback(async () => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;

    cleanupProtection();
    safeSetLocked(false);
    safeSetTapCount(0);

    await cancelFinishNotification();
    await deactivateKeepAwakeSafe();

    const cb = onAutoFinishRef.current;
    if (!cb) return;

    try {
      const ret = cb();
      if (ret && typeof (ret as Promise<void>).then === "function") {
        await ret;
      }
    } catch (err) {
      console.warn(`[${testName}] onAutoFinish error:`, err);
    }
  }, [
    cancelFinishNotification,
    cleanupProtection,
    deactivateKeepAwakeSafe,
    safeSetLocked,
    safeSetTapCount,
    testName,
  ]);

  const resetProtection = useCallback(() => {
    cleanupProtection();
    finishCalledRef.current = false;
    stopCalledRef.current = false;
    startedAtMsRef.current = null;
    safeSetLocked(false);
    safeSetTapCount(0);
    safeSetElapsed(0);
  }, [cleanupProtection, safeSetElapsed, safeSetLocked, safeSetTapCount]);

  useEffect(() => {
    if (!enabled) {
      resetProtection();
      cancelFinishNotification().catch(() => {});
      deactivateKeepAwakeSafe().catch(() => {});
      return;
    }

    if (isRunning) {
      finishCalledRef.current = false;
      stopCalledRef.current = false;
      startedAtMsRef.current = Date.now();

      safeSetLocked(true);
      safeSetTapCount(0);
      safeSetElapsed(0);

      cleanupProtection();

      activateKeepAwakeSafe();
      scheduleFinishNotification();

      elapsedTimerRef.current = setInterval(() => {
        const startedAt = startedAtMsRef.current;
        if (startedAt == null) return;
        const elapsed = Date.now() - startedAt;
        safeSetElapsed(elapsed);

        if (
          durationMs &&
          durationMs > 0 &&
          elapsed >= durationMs &&
          !finishCalledRef.current
        ) {
          void safeAutoFinish();
        }
      }, 200);

      if (durationMs && durationMs > 0) {
        autoFinishTimerRef.current = setTimeout(() => {
          if (!finishCalledRef.current) {
            void safeAutoFinish();
          }
        }, durationMs);
      }
    } else {
      cleanupProtection();
      safeSetLocked(false);
      safeSetTapCount(0);
      finishCalledRef.current = false;
      stopCalledRef.current = false;
      startedAtMsRef.current = null;

      cancelFinishNotification().catch(() => {});
      deactivateKeepAwakeSafe().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, enabled, durationMs]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (!isRunningRef.current) return;

        console.log(`[${testName}] AppState changed:`, nextState);

        if (nextState === "active") {
          const startedAt = startedAtMsRef.current;
          if (
            startedAt != null &&
            durationMs &&
            durationMs > 0 &&
            !finishCalledRef.current
          ) {
            const elapsed = Date.now() - startedAt;
            safeSetElapsed(elapsed);
            if (elapsed >= durationMs) {
              void safeAutoFinish();
            }
          }
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [durationMs, safeAutoFinish, safeSetElapsed, testName]);

  useEffect(() => {
    if (!enabled) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isRunningRef.current && lockedRef.current) {
        onBeforeExitBlockedRef.current?.();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !navigation || typeof navigation.addListener !== "function") {
      return;
    }

    const remove = navigation.addListener("beforeRemove", (e: any) => {
      if (isRunningRef.current && lockedRef.current) {
        try {
          e.preventDefault?.();
        } catch {
          /* ignore */
        }
        onBeforeExitBlockedRef.current?.();
      }
    });

    return () => {
      if (typeof remove === "function") {
        remove();
      } else if (typeof navigation.removeListener === "function") {
        navigation.removeListener("beforeRemove", remove);
      }
    };
  }, [enabled, navigation]);

  useEffect(() => {
    if (!enabled || !navigation || typeof navigation.setOptions !== "function") {
      return;
    }

    if (isRunning && locked) {
      try {
        navigation.setOptions({ gestureEnabled: false });
      } catch {
        /* ignore */
      }
    }
  }, [enabled, isRunning, locked, navigation]);

  useEffect(() => {
    return () => {
      cleanupProtection();
      cancelFinishNotification().catch(() => {});
      deactivateKeepAwakeSafe().catch(() => {});
    };
  }, [cancelFinishNotification, cleanupProtection, deactivateKeepAwakeSafe]);

  const handleLockTap = useCallback(() => {
    if (!isRunningRef.current) return;
    if (!lockedRef.current) return;

    setTapCount((prev) => {
      const next = prev + 1;

      if (!tapWindowTimerRef.current) {
        tapWindowTimerRef.current = setTimeout(() => {
          tapWindowTimerRef.current = null;
          safeSetTapCount(0);
        }, TAP_WINDOW_MS);
      }

      if (next >= REQUIRED_TAPS) {
        clearTimer(tapWindowTimerRef);
        clearTimer(relockTimerRef);

        safeSetLocked(false);

        relockTimerRef.current = setTimeout(() => {
          relockTimerRef.current = null;
          if (isRunningRef.current && !finishCalledRef.current) {
            safeSetLocked(true);
            safeSetTapCount(0);
          }
        }, UNLOCK_GRACE_MS);

        return 0;
      }

      return next;
    });
  }, [safeSetLocked, safeSetTapCount]);

  const forceLock = useCallback(() => {
    clearTimer(relockTimerRef);
    clearTimer(tapWindowTimerRef);
    safeSetLocked(true);
    safeSetTapCount(0);
  }, [safeSetLocked, safeSetTapCount]);

  const forceUnlock = useCallback(() => {
    clearTimer(tapWindowTimerRef);
    safeSetLocked(false);
    safeSetTapCount(0);
  }, [safeSetLocked, safeSetTapCount]);

  const guardedStop = useCallback(
    async (stopFn: () => void | Promise<void>) => {
      if (lockedRef.current) {
        console.log(`[${testName}] guardedStop ignored: still locked`);
        return;
      }
      if (stopCalledRef.current) {
        console.log(`[${testName}] guardedStop ignored: already stopping`);
        return;
      }
      stopCalledRef.current = true;

      clearTimer(relockTimerRef);
      clearTimer(tapWindowTimerRef);

      await cancelFinishNotification();

      try {
        const ret = stopFn();
        if (ret && typeof (ret as Promise<void>).then === "function") {
          await ret;
        }
      } catch (err) {
        console.warn(`[${testName}] guardedStop stopFn error:`, err);
        throw err;
      } finally {
        stopCalledRef.current = false;
      }
    },
    [cancelFinishNotification, testName]
  );

  return {
    locked,
    unlocked: !locked,
    tapCount,
    startedAtMsRef,
    elapsedMs,
    handleLockTap,
    canStopManually: !locked,
    guardedStop,
    forceLock,
    forceUnlock,
    resetProtection,
  };
}

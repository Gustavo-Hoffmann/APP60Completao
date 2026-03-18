import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";

type Theme = {
  mode: ThemeMode;
  colors: {
    bg: string;
    card: string;
    text: string;
    muted: string;
    primary: string;
    border: string;
    danger: string;
  };
};

const THEME_KEY = "APP_THEME_MODE";

const lightTheme: Theme = {
  mode: "light",
  colors: {
    bg: "#FFFFFF",
    card: "#F6F8FF",
    text: "#0B1220",
    muted: "#5B657A",
    primary: "#0B5FFF",
    border: "#D6DCEC",
    danger: "#D64545",
  },
};

const darkTheme: Theme = {
  mode: "dark",
  colors: {
    bg: "#0B0F1A",
    card: "#11182A",
    text: "#F2F5FF",
    muted: "#A9B2C7",
    primary: "#2A7BFF",
    border: "#24314D",
    danger: "#FF6B6B",
  },
};

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setModeState(saved);
    })();
  }, []);

  const setMode = async (m: ThemeMode) => {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  };

  const toggle = () => setMode(mode === "light" ? "dark" : "light");

  const theme = useMemo(() => (mode === "light" ? lightTheme : darkTheme), [mode]);

  return <ThemeContext.Provider value={{ theme, toggle, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
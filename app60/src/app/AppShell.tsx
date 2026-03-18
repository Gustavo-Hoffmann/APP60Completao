import React from "react";
import { NavigationRoot } from "../navigation";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";

export function AppShell() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}
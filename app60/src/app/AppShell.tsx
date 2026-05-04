import React from "react";
import { NavigationRoot } from "../navigation";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import { EnvironmentBadge } from "../components/EnvironmentBadge";

export function AppShell() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationRoot />
        <EnvironmentBadge />
      </AuthProvider>
    </ThemeProvider>
  );
}
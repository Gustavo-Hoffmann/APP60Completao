import type { ReactNode } from "react";
import { AuthProvider } from "../contexts/AuthContext";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return <AuthProvider>{children}</AuthProvider>;
}
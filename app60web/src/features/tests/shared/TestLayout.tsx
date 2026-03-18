import type { ReactNode } from "react";
import { AppHeader } from "../../../components/layout/AppHeader";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function TestLayout({ title, subtitle, children }: Props) {
  return (
    <div>
      <AppHeader title={title} subtitle={subtitle} />
      <div className="p-6">{children}</div>
    </div>
  );
}
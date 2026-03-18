import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-soft ${className}`}>
      {children}
    </div>
  );
}
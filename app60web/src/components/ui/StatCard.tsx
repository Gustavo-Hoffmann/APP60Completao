import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
};

export function StatCard({ title, value, icon: Icon, subtitle }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="relative p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-slate-900" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {title}
            </p>
            <h3 className="text-3xl font-black tracking-tight text-slate-900">{value}</h3>
            {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
            <Icon size={22} />
          </div>
        </div>
      </div>
    </Card>
  );
}
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
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
          {subtitle && <p className="mt-2 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="rounded-xl bg-brand-600 p-3 text-white">
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}
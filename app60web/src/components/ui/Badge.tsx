type Props = {
    children: string;
    tone?: "blue" | "green" | "yellow" | "red" | "slate";
  };
  
  export function Badge({ children, tone = "blue" }: Props) {
    const styles = {
      blue: "bg-blue-100 text-blue-700",
      green: "bg-emerald-100 text-emerald-700",
      yellow: "bg-amber-100 text-amber-700",
      red: "bg-red-100 text-red-700",
      slate: "bg-slate-100 text-slate-700",
    };
  
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>
        {children}
      </span>
    );
  }